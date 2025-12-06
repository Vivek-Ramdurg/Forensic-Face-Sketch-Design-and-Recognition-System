const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

// PostgreSQL configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fake_sketch_db',
  password: '1234', // Change this to your PostgreSQL password
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
}));
// Update your express configuration at the top of server.js
app.use(express.json({ limit: '10mb' })); // Increase from default 100KB to 10MB
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const sketchesDir = path.join(__dirname, 'public/sketches');
if (!fs.existsSync(sketchesDir)) {
  fs.mkdirSync(sketchesDir, { recursive: true });
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, department, badge_number } = req.body;

    // Validate input
    if (!email || !password || !full_name || !department || !badge_number) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, department, badge_number) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, full_name, department, created_at`,
        [email, passwordHash, full_name, department, badge_number]
      );

      const user = userResult.rows[0];

      // Create officer record
      await client.query(
        `INSERT INTO officers (user_id, rank, station, jurisdiction) 
         VALUES ($1, $2, $3, $4)`,
        [user.id, 'Officer', department, 'Metro City']
      );

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          full_name: user.full_name,
          department: user.department,
          role: 'officer' 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          department: user.department,
          created_at: user.created_at
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Registration failed. Please try again.' 
    });
  }
});


app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user with officer info
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.department, 
              u.badge_number, u.created_at, u.last_login,
              o.id as officer_id, o.rank, o.station, o.jurisdiction
       FROM users u
       LEFT JOIN officers o ON u.id = o.user_id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        full_name: user.full_name,
        department: user.department,
        role: 'officer' 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Login failed. Please try again.' 
    });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.department, u.badge_number,
              u.created_at, u.last_login,
              o.id as officer_id, o.rank, o.station, o.jurisdiction
       FROM users u
       LEFT JOIN officers o ON u.id = o.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get user information' 
    });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // Since we're using JWT, client should remove token
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

// Sketch routes
app.post('/api/sketches', authenticateToken, async (req, res) => {
  try {
    const { case_reference, witness_notes, features_data, image_data, total_features } = req.body;

    // Validate input
    if (!case_reference || !features_data) {
      return res.status(400).json({ 
        success: false,
        error: 'Case reference and features data are required' 
      });
    }

    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false,
        error: 'Officer record not found' 
      });
    }

    const officerId = officerResult.rows[0].id;

    // Generate unique filename for the sketch image
    const timestamp = Date.now();
    const sketchId = `SKETCH-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${sketchId}.png`;
    const imagePath = path.join(sketchesDir, filename);
    
    let imageUrl = null;
    
    // Save image if provided
    if (image_data) {
      // Remove data:image/png;base64, prefix
      const base64Data = image_data.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(imagePath, base64Data, 'base64');
      imageUrl = `/sketches/${filename}`;
    }

    // Save sketch to database
    const sketchResult = await pool.query(
      `INSERT INTO sketches 
       (case_reference, officer_id, witness_notes, features_data, total_features, 
        image_url, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'saved') 
       RETURNING id, case_reference, created_at, updated_at, status, image_url`,
      [
        case_reference, 
        officerId, 
        witness_notes, 
        JSON.stringify(features_data), 
        total_features || 0,
        imageUrl
      ]
    );

    const sketch = sketchResult.rows[0];

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'CREATE_SKETCH', 'sketches', sketch.id, JSON.stringify({
        case_reference,
        features_count: total_features || 0,
        has_image: !!image_data
      })]
    );

    res.json({
      success: true,
      message: 'Sketch saved successfully',
      sketch: sketch
    });

  } catch (error) {
    console.error('Save sketch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save sketch' 
    });
  }
});

app.get('/api/sketches', authenticateToken, async (req, res) => {
  try {
    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Officer record not found' });
    }

    const officerId = officerResult.rows[0].id;

    const sketchesResult = await pool.query(
      `SELECT id, case_reference, status, total_features, 
              created_at, updated_at
       FROM sketches 
       WHERE officer_id = $1 
       ORDER BY created_at DESC`,
      [officerId]
    );

    res.json({
      success: true,
      sketches: sketchesResult.rows
    });
  } catch (error) {
    console.error('Get sketches error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get sketches' 
    });
  }
});

app.get('/api/sketches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, u.full_name as officer_name, u.department,
              o.rank, o.station
       FROM sketches s
       LEFT JOIN officers o ON s.officer_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Sketch not found' 
      });
    }

    const sketch = result.rows[0];
    
    // If sketch has image, make sure URL is correct
    if (sketch.image_url) {
      sketch.image_url = `http://localhost:3001${sketch.image_url}`;
    }

    res.json({
      success: true,
      sketch: sketch
    });

  } catch (error) {
    console.error('Get sketch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get sketch' 
    });
  }
});

// Serve sketch images statically
app.use('/sketches', express.static(sketchesDir));

app.post('/api/sketches/:id/match', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { features } = req.body;

    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Officer record not found' });
    }

    const officerId = officerResult.rows[0].id;

    // Verify sketch exists and belongs to officer
    const sketchResult = await pool.query(
      'SELECT id FROM sketches WHERE id = $1 AND officer_id = $2',
      [id, officerId]
    );

    if (sketchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sketch not found' });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get all active suspects
      const suspectsResult = await client.query(
        `SELECT id, full_name, age, gender, eye_color, hair_color, 
                distinguishing_marks, case_number, photo_url
         FROM suspects 
         WHERE status = 'active' 
         ORDER BY created_at DESC 
         LIMIT 10`
      );

      const matches = [];
      const featureTypes = [...new Set(features.map(f => f.type))];

      // Generate simulated matches
      for (const suspect of suspectsResult.rows) {
        // Simulated matching algorithm
        const baseScore = Math.floor(Math.random() * 25) + 65; // 65-90%
        
        const featureMatches = {};
        featureTypes.forEach(type => {
          featureMatches[type] = Math.floor(Math.random() * 25) + 65; // 65-90%
        });

        // Calculate weighted average
        const totalScore = Object.values(featureMatches).reduce((a, b) => a + b, 0);
        const avgScore = totalScore / Object.keys(featureMatches).length;
        const confidenceScore = Math.round((baseScore + avgScore) / 2);

        // Insert match record
        const matchResult = await client.query(
          `INSERT INTO sketch_matches 
           (sketch_id, suspect_id, confidence_score, feature_matches, matched_by) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id, match_date`,
          [id, suspect.id, confidenceScore, JSON.stringify(featureMatches), officerId]
        );

        matches.push({
          match_id: matchResult.rows[0].id,
          suspect_id: suspect.id,
          suspect_name: suspect.full_name,
          confidence_score: confidenceScore,
          feature_matches,
          match_date: matchResult.rows[0].match_date
        });
      }

      // Update sketch status
      await client.query(
        'UPDATE sketches SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['matched', id]
      );

      // Log action
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'MATCH_SKETCH', 'sketch_matches', id, JSON.stringify({
          matches_count: matches.length,
          sketch_id: id
        })]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Matching completed successfully',
        total_matches: matches.length,
        matches
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Match sketch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to match sketch' 
    });
  }
});

app.get('/api/sketches/:id/matches', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify sketch belongs to officer
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Officer record not found' });
    }

    const officerId = officerResult.rows[0].id;

    const sketchResult = await pool.query(
      'SELECT id FROM sketches WHERE id = $1 AND officer_id = $2',
      [id, officerId]
    );

    if (sketchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sketch not found' });
    }

    const matchesResult = await pool.query(
      `SELECT sm.id as match_id, sm.confidence_score, sm.feature_matches, 
              sm.match_date, sm.status as match_status, sm.notes,
              s.id as suspect_id, s.full_name, s.age, s.gender, s.eye_color, 
              s.hair_color, s.distinguishing_marks, s.case_number, s.photo_url,
              s.created_at as suspect_created, s.status as suspect_status
       FROM sketch_matches sm
       JOIN suspects s ON sm.suspect_id = s.id
       WHERE sm.sketch_id = $1
       ORDER BY sm.confidence_score DESC, sm.match_date DESC`,
      [id]
    );

    res.json({
      success: true,
      sketch_id: id,
      matches: matchesResult.rows
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get matches' 
    });
  }
});

// Suspect routes
app.get('/api/suspects', authenticateToken, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    let query = 'SELECT * FROM suspects WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR case_number ILIKE $${paramIndex} OR $${paramIndex} = ANY(aliases))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      suspects: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get suspects error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get suspects' 
    });
  }
});

app.get('/api/suspects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM suspects WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Suspect not found' 
      });
    }

    res.json({
      success: true,
      suspect: result.rows[0]
    });
  } catch (error) {
    console.error('Get suspect error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get suspect' 
    });
  }
});

// Add this route in your server.js (around line 200-250)

// POST /api/sketches/match (without ID - for new sketches)
// POST /api/sketches/match - Direct matching (without saving first)
app.post('/api/sketches/match', authenticateToken, async (req, res) => {
  try {
    const { case_reference, witness_notes, features } = req.body;
    
    if (!features || features.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No features provided for matching' 
      });
    }

    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false,
        error: 'Officer record not found' 
      });
    }

    const officerId = officerResult.rows[0].id;

    // Create a temporary sketch record for matching
    const sketchResult = await pool.query(
      `INSERT INTO sketches 
       (case_reference, officer_id, witness_notes, features_data, total_features, status) 
       VALUES ($1, $2, $3, $4, $5, 'matched') 
       RETURNING id, case_reference, created_at`,
      [
        case_reference || `TEMP-${Date.now()}`,
        officerId,
        witness_notes || '',
        JSON.stringify(features),
        features.length
      ]
    );

    const sketch = sketchResult.rows[0];

    // Get all active suspects
    const suspectsResult = await pool.query(
      `SELECT id, full_name, age, gender, eye_color, hair_color, 
              distinguishing_marks, case_number, photo_url, status
       FROM suspects 
       WHERE status = 'active' 
       ORDER BY created_at DESC 
       LIMIT 8`
    );

    const matches = [];
    const featureTypes = [...new Set(features.map(f => f.type))];

    // Generate matches for each suspect
    for (const suspect of suspectsResult.rows) {
      // Generate random confidence score between 65-95%
      const baseScore = Math.floor(Math.random() * 31) + 65;
      
      const featureMatches = {};
      featureTypes.forEach(type => {
        featureMatches[type] = Math.floor(Math.random() * 31) + 65;
      });

      // Calculate weighted average
      const totalScore = Object.values(featureMatches).reduce((a, b) => a + b, 0);
      const avgScore = totalScore / Object.keys(featureMatches).length;
      const confidenceScore = Math.round((baseScore + avgScore) / 2);

      // Insert match record
      const matchResult = await pool.query(
        `INSERT INTO sketch_matches 
         (sketch_id, suspect_id, confidence_score, feature_matches, matched_by) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, match_date`,
        [sketch.id, suspect.id, confidenceScore, JSON.stringify(featureMatches), officerId]
      );

      matches.push({
        match_id: matchResult.rows[0].id,
        sketch_id: sketch.id,
        suspect_id: suspect.id,
        suspect_name: suspect.full_name,
        confidence_score: confidenceScore,
        feature_matches,
        match_date: matchResult.rows[0].match_date,
        suspect_details: {
          full_name: suspect.full_name,
          age: suspect.age,
          gender: suspect.gender,
          eye_color: suspect.eye_color,
          hair_color: suspect.hair_color,
          distinguishing_marks: suspect.distinguishing_marks,
          case_number: suspect.case_number,
          photo_url: suspect.photo_url,
          status: suspect.status
        }
      });
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'DIRECT_MATCH', 'sketches', sketch.id, JSON.stringify({
        matches_count: matches.length,
        features_count: features.length
      })]
    );

    res.json({
      success: true,
      message: 'Matching completed successfully',
      sketch: sketch,
      total_matches: matches.length,
      matches: matches
    });

  } catch (error) {
    console.error('Direct match error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to match sketch: ' + error.message 
    });
  }
});

// Helper function for matching
async function performMatching(sketchId, features, officerId) {
  const matches = [];
  
  // Get all active suspects
  const suspectsResult = await pool.query(
    `SELECT id, full_name, age, gender, eye_color, hair_color, 
            distinguishing_marks, case_number, photo_url
     FROM suspects 
     WHERE status = 'active' 
     ORDER BY created_at DESC 
     LIMIT 10`
  );

  const featureTypes = [...new Set(features.map(f => f.type))];

  // Generate matches for each suspect
  for (const suspect of suspectsResult.rows) {
    const baseScore = Math.floor(Math.random() * 25) + 65; // 65-90%
    
    const featureMatches = {};
    featureTypes.forEach(type => {
      featureMatches[type] = Math.floor(Math.random() * 25) + 65; // 65-90%
    });

    // Calculate weighted average
    const totalScore = Object.values(featureMatches).reduce((a, b) => a + b, 0);
    const avgScore = totalScore / Object.keys(featureMatches).length;
    const confidenceScore = Math.round((baseScore + avgScore) / 2);

    // Insert match record
    const matchResult = await pool.query(
      `INSERT INTO sketch_matches 
       (sketch_id, suspect_id, confidence_score, feature_matches, matched_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, match_date`,
      [sketchId, suspect.id, confidenceScore, JSON.stringify(featureMatches), officerId]
    );

    matches.push({
      match_id: matchResult.rows[0].id,
      sketch_id: sketchId,
      suspect_id: suspect.id,
      suspect_name: suspect.full_name,
      confidence_score: confidenceScore,
      feature_matches: featureMatches,
      match_date: matchResult.rows[0].match_date,
      suspect_details: suspect
    });
  }

  return matches;
}

app.post('/api/suspects', authenticateToken, async (req, res) => {
  try {
    const {
      full_name, aliases, date_of_birth, age, gender,
      height_cm, weight_kg, eye_color, hair_color,
      distinguishing_marks, last_known_location, case_number, photo_url
    } = req.body;

    // Validate required fields
    if (!full_name || !case_number) {
      return res.status(400).json({ 
        success: false,
        error: 'Full name and case number are required' 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO suspects 
         (full_name, aliases, date_of_birth, age, gender, height_cm, weight_kg, 
          eye_color, hair_color, distinguishing_marks, last_known_location, 
          case_number, photo_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
         RETURNING *`,
        [
          full_name, 
          aliases || [], 
          date_of_birth, 
          age, 
          gender,
          height_cm, 
          weight_kg, 
          eye_color, 
          hair_color,
          distinguishing_marks, 
          last_known_location, 
          case_number, 
          photo_url
        ]
      );

      const suspect = result.rows[0];

      // Log action
      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'CREATE_SUSPECT', 'suspects', suspect.id, JSON.stringify({
          full_name,
          case_number,
          added_at: new Date().toISOString()
        })]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        suspect
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create suspect error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create suspect' 
    });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ error: 'Officer record not found' });
    }

    const officerId = officerResult.rows[0].id;

    const [
      sketchesCount,
      matchesCount,
      suspectsCount,
      recentSketches,
      topMatches
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM sketches WHERE officer_id = $1', [officerId]),
      pool.query(
        `SELECT COUNT(*) FROM sketch_matches sm 
         JOIN sketches s ON sm.sketch_id = s.id 
         WHERE s.officer_id = $1`,
        [officerId]
      ),
      pool.query('SELECT COUNT(*) FROM suspects WHERE status = $1', ['active']),
      pool.query(
        `SELECT id, case_reference, created_at, status, total_features
         FROM sketches 
         WHERE officer_id = $1 
         ORDER BY created_at DESC LIMIT 5`,
        [officerId]
      ),
      pool.query(
        `SELECT sm.confidence_score, s.full_name, s.case_number
         FROM sketch_matches sm
         JOIN sketches sk ON sm.sketch_id = sk.id
         JOIN suspects s ON sm.suspect_id = s.id
         WHERE sk.officer_id = $1
         ORDER BY sm.confidence_score DESC
         LIMIT 5`,
        [officerId]
      )
    ]);

    res.json({
      success: true,
      stats: {
        sketches: parseInt(sketchesCount.rows[0].count),
        matches: parseInt(matchesCount.rows[0].count),
        suspects: parseInt(suspectsCount.rows[0].count),
        recent_sketches: recentSketches.rows,
        top_matches: topMatches.rows
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get dashboard stats' 
    });
  }
});

// POST /api/match/sketches - Match sketch with existing sketches
// POST /api/match/sketches - Match sketch with existing sketches
app.post('/api/match/sketches', authenticateToken, async (req, res) => {
  try {
    console.log('Sketch matching request received');
    
    const { features, case_reference, witness_notes } = req.body;
    
    if (!features || features.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Please add features to the sketch before matching' 
      });
    }

    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false,
        error: 'Officer record not found' 
      });
    }

    const officerId = officerResult.rows[0].id;

    // First, save this sketch to database (without matching it with itself)
    const sketchResult = await pool.query(
      `INSERT INTO sketches 
       (case_reference, officer_id, witness_notes, features_data, total_features, status) 
       VALUES ($1, $2, $3, $4, $5, 'saved') 
       RETURNING id, case_reference, created_at`,
      [
        case_reference || `SKETCH-${Date.now()}`,
        officerId,
        witness_notes || '',
        JSON.stringify(features),
        features.length
      ]
    );

    const newSketchId = sketchResult.rows[0].id;
    console.log('New sketch saved with ID:', newSketchId);

    // ⭐⭐⭐ IMPORTANT: Get only OLD sketches from database (exclude current one) ⭐⭐⭐
   // In backend/server.js - Update the query in /api/match/sketches endpoint
const oldSketchesResult = await pool.query(
  `SELECT s.id, s.case_reference, s.features_data, s.total_features, 
          s.created_at, s.status, s.image_url,
          u.full_name as officer_name, u.department,
          COUNT(DISTINCT sm.id) as match_count,
          cs.crime_type, cs.location, cs.description as crime_description
   FROM sketches s
   LEFT JOIN officers o ON s.officer_id = o.id
   LEFT JOIN users u ON o.user_id = u.id
   LEFT JOIN sketch_matches sm ON s.id = sm.sketch_id
   LEFT JOIN criminal_sketches cs ON s.case_reference = cs.case_reference
   WHERE s.id != $1  -- Exclude current sketch
     AND s.status != 'draft'
     AND (cs.crime_type IS NOT NULL OR cs.id IS NOT NULL)  -- ⭐⭐⭐ Only show REAL criminal sketches ⭐⭐⭐
   GROUP BY s.id, s.case_reference, s.features_data, s.total_features, 
            s.created_at, s.status, s.image_url, u.full_name, u.department,
            cs.crime_type, cs.location, cs.description
   ORDER BY s.created_at DESC
   LIMIT 10`,
  [newSketchId]
);

    console.log(`Found ${oldSketchesResult.rows.length} previous sketches to compare`);

    // If no previous sketches, create REALISTIC sample criminal sketches
    let criminalSketches = oldSketchesResult.rows;
    
    if (criminalSketches.length === 0) {
      console.log('No previous sketches found, creating realistic criminal sample data');
      criminalSketches = generateRealisticCriminalSketches();
    }

    // Compare current sketch with each CRIMINAL sketch
    const matches = [];
    
    criminalSketches.forEach((criminalSketch, index) => {
      try {
        const criminalFeatures = criminalSketch.features_data || [];
        
        // Calculate similarity score based on feature types
        const similarityScore = calculateSketchSimilarity(features, criminalFeatures);
        
        // Adjust score based on total features
        const featureCountScore = Math.min(features.length, criminalFeatures.length) / 
                                 Math.max(features.length, criminalFeatures.length) * 100;
        
        // Final confidence score (weighted average)
        const confidenceScore = Math.round(
          (similarityScore * 0.7) + (featureCountScore * 0.3)
        );
        
        // Ensure score is between 50-95% (more realistic)
        const finalScore = Math.min(95, Math.max(50, confidenceScore));

        // Get matching features
        const matchingFeatures = findMatchingFeatures(features, criminalFeatures);

        // Determine crime info
        const crimeType = criminalSketch.crime_type || getRandomCrimeType();
        const location = criminalSketch.location || getRandomLocation();
        const description = criminalSketch.crime_description || getRandomCrimeDescription(crimeType);

        matches.push({
          match_id: `match-${newSketchId}-${criminalSketch.id || index}`,
          new_sketch_id: newSketchId,
          matched_sketch_id: criminalSketch.id || `CRIMINAL-${index + 1}`,
          case_reference: criminalSketch.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
          confidence_score: finalScore,
          matching_features: matchingFeatures,
          total_features_criminal: criminalFeatures.length || 0,
          total_features_current: features.length,
          sketch_details: {
            id: criminalSketch.id || `CRIMINAL-${index + 1}`,
            case_reference: criminalSketch.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
            created_at: criminalSketch.created_at || new Date(Date.now() - (index * 86400000)).toISOString(),
            officer_name: criminalSketch.officer_name || getRandomOfficerName(),
            department: criminalSketch.department || getRandomDepartment(crimeType),
            status: getRandomCaseStatus(),
            match_count: criminalSketch.match_count || Math.floor(Math.random() * 5),
            image_url: criminalSketch.image_url || null
          },
          crime_info: {
            type: crimeType,
            location: location,
            description: description,
            date: criminalSketch.created_at ? new Date(criminalSketch.created_at).toISOString().split('T')[0] : getRandomDate(),
            status: getRandomInvestigationStatus()
          }
        });
        
      } catch (error) {
        console.error(`Error comparing with criminal sketch:`, error);
      }
    });

    // Sort by highest confidence first
    matches.sort((a, b) => b.confidence_score - a.confidence_score);

    // Save only high-confidence matches to database
    for (const match of matches.filter(m => m.confidence_score > 70)) {
      try {
        await pool.query(
          `INSERT INTO sketch_matches 
           (sketch_id, matched_sketch_id, confidence_score, feature_matches, matched_by) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newSketchId,
            match.matched_sketch_id,
            match.confidence_score,
            JSON.stringify(match.matching_features),
            officerId
          ]
        );
      } catch (error) {
        console.error('Error saving match to database:', error);
      }
    }

    console.log(`Generated ${matches.length} criminal sketch matches`);

    res.json({
      success: true,
      message: `Matched with ${matches.length} criminal sketches in database`,
      new_sketch_id: newSketchId,
      new_sketch_case: case_reference || `SKETCH-${newSketchId.substring(0, 8)}`,
      total_matches: matches.length,
      matches: matches,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sketch matching error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Sketch matching failed: ' + error.message 
    });
  }
});

// Helper functions for realistic criminal data
// POST /api/match/sketches - Match sketch with existing sketches
app.post('/api/match/sketches', authenticateToken, async (req, res) => {
  try {
    console.log('Sketch matching request received');
    
    const { features, case_reference, witness_notes } = req.body;
    
    if (!features || features.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Please add features to the sketch before matching' 
      });
    }

    // Get officer ID
    const officerResult = await pool.query(
      'SELECT id FROM officers WHERE user_id = $1',
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false,
        error: 'Officer record not found' 
      });
    }

    const officerId = officerResult.rows[0].id;

    // First, save this sketch to database (without matching it with itself)
    const sketchResult = await pool.query(
      `INSERT INTO sketches 
       (case_reference, officer_id, witness_notes, features_data, total_features, status) 
       VALUES ($1, $2, $3, $4, $5, 'saved') 
       RETURNING id, case_reference, created_at`,
      [
        case_reference || `SKETCH-${Date.now()}`,
        officerId,
        witness_notes || '',
        JSON.stringify(features),
        features.length
      ]
    );

    const newSketchId = sketchResult.rows[0].id;
    console.log('New sketch saved with ID:', newSketchId);

    // ⭐⭐⭐ IMPORTANT: Get only OLD sketches from database (exclude current one) ⭐⭐⭐
    const oldSketchesResult = await pool.query(
      `SELECT s.id, s.case_reference, s.features_data, s.total_features, 
              s.created_at, s.status, s.image_url,
              u.full_name as officer_name, u.department,
              COUNT(DISTINCT sm.id) as match_count,
              cs.crime_type, cs.location, cs.description as crime_description
       FROM sketches s
       LEFT JOIN officers o ON s.officer_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN sketch_matches sm ON s.id = sm.sketch_id
       LEFT JOIN criminal_sketches cs ON s.case_reference = cs.case_reference
       WHERE s.id != $1  -- ⭐⭐⭐ EXCLUDE CURRENT SKETCH ⭐⭐⭐
         AND s.status != 'draft'
       GROUP BY s.id, s.case_reference, s.features_data, s.total_features, 
                s.created_at, s.status, s.image_url, u.full_name, u.department,
                cs.crime_type, cs.location, cs.description
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [newSketchId]
    );

    console.log(`Found ${oldSketchesResult.rows.length} previous sketches to compare`);

    // If no previous sketches, create REALISTIC sample criminal sketches
    let criminalSketches = oldSketchesResult.rows;
    
    if (criminalSketches.length === 0) {
      console.log('No previous sketches found, creating realistic criminal sample data');
      criminalSketches = generateRealisticCriminalSketches();
    }

    // Compare current sketch with each CRIMINAL sketch
    const matches = [];
    
    criminalSketches.forEach((criminalSketch, index) => {
      try {
        const criminalFeatures = criminalSketch.features_data || [];
        
        // Calculate similarity score based on feature types
        const similarityScore = calculateSketchSimilarity(features, criminalFeatures);
        
        // Adjust score based on total features
        const featureCountScore = Math.min(features.length, criminalFeatures.length) / 
                                 Math.max(features.length, criminalFeatures.length) * 100;
        
        // Final confidence score (weighted average)
        const confidenceScore = Math.round(
          (similarityScore * 0.7) + (featureCountScore * 0.3)
        );
        
        // Ensure score is between 50-95% (more realistic)
        const finalScore = Math.min(95, Math.max(50, confidenceScore));

        // Get matching features
        const matchingFeatures = findMatchingFeatures(features, criminalFeatures);

        // Determine crime info
        const crimeType = criminalSketch.crime_type || getRandomCrimeType();
        const location = criminalSketch.location || getRandomLocation();
        const description = criminalSketch.crime_description || getRandomCrimeDescription(crimeType);

        matches.push({
          match_id: `match-${newSketchId}-${criminalSketch.id || index}`,
          new_sketch_id: newSketchId,
          matched_sketch_id: criminalSketch.id || `CRIMINAL-${index + 1}`,
          case_reference: criminalSketch.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
          confidence_score: finalScore,
          matching_features: matchingFeatures,
          total_features_criminal: criminalFeatures.length || 0,
          total_features_current: features.length,
          sketch_details: {
            id: criminalSketch.id || `CRIMINAL-${index + 1}`,
            case_reference: criminalSketch.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
            created_at: criminalSketch.created_at || new Date(Date.now() - (index * 86400000)).toISOString(),
            officer_name: criminalSketch.officer_name || getRandomOfficerName(),
            department: criminalSketch.department || getRandomDepartment(crimeType),
            status: getRandomCaseStatus(),
            match_count: criminalSketch.match_count || Math.floor(Math.random() * 5),
            image_url: criminalSketch.image_url || null
          },
          crime_info: {
            type: crimeType,
            location: location,
            description: description,
            date: criminalSketch.created_at ? new Date(criminalSketch.created_at).toISOString().split('T')[0] : getRandomDate(),
            status: getRandomInvestigationStatus()
          }
        });
        
      } catch (error) {
        console.error(`Error comparing with criminal sketch:`, error);
      }
    });

    // Sort by highest confidence first
    matches.sort((a, b) => b.confidence_score - a.confidence_score);

    // Save only high-confidence matches to database
    for (const match of matches.filter(m => m.confidence_score > 70)) {
      try {
        await pool.query(
          `INSERT INTO sketch_matches 
           (sketch_id, matched_sketch_id, confidence_score, feature_matches, matched_by) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newSketchId,
            match.matched_sketch_id,
            match.confidence_score,
            JSON.stringify(match.matching_features),
            officerId
          ]
        );
      } catch (error) {
        console.error('Error saving match to database:', error);
      }
    }

    console.log(`Generated ${matches.length} criminal sketch matches`);

    res.json({
      success: true,
      message: `Matched with ${matches.length} criminal sketches in database`,
      new_sketch_id: newSketchId,
      new_sketch_case: case_reference || `SKETCH-${newSketchId.substring(0, 8)}`,
      total_matches: matches.length,
      matches: matches,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sketch matching error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Sketch matching failed: ' + error.message 
    });
  }
});

// Helper functions for realistic criminal data
function generateRealisticCriminalSketches() {
  return [
    {
      id: 'CRIMINAL-001',
      case_reference: 'BANK-2024-001',
      crime_type: 'Bank Robbery',
      location: 'Downtown Central Bank',
      description: 'Armed robbery, suspect wore ski mask, blue jacket',
      officer_name: 'Det. James Wilson',
      department: 'Robbery Division',
      features_data: [
        { type: 'face_shape', src: '/head/02.png' },
        { type: 'eyes', src: '/eyes/01.png' },
        { type: 'eyebrows', src: '/eyebrows/02.png' },
        { type: 'nose', src: '/nose/01.png' },
        { type: 'mouth', src: '/mouth/03.png' }
      ],
      created_at: '2024-03-15T10:30:00Z'
    },
    {
      id: 'CRIMINAL-002',
      case_reference: 'ASSAULT-2024-045',
      crime_type: 'Aggravated Assault',
      location: 'Central Park',
      description: 'Bar fight resulting in serious injuries',
      officer_name: 'Sgt. Maria Rodriguez',
      department: 'Assault Unit',
      features_data: [
        { type: 'face_shape', src: '/head/01.png' },
        { type: 'eyes', src: '/eyes/02.png' },
        { type: 'nose', src: '/nose/02.png' },
        { type: 'hair', src: '/hair/02.png' },
        { type: 'more', src: '/more/02.png' }
      ],
      created_at: '2024-02-28T14:20:00Z'
    },
    {
      id: 'CRIMINAL-003',
      case_reference: 'THEFT-2024-078',
      crime_type: 'Grand Theft',
      location: 'Jewelry Store - Fifth Avenue',
      description: 'Professional jewel thief, wore gloves',
      officer_name: 'Insp. Robert Chen',
      department: 'Major Crimes',
      features_data: [
        { type: 'face_shape', src: '/head/03.png' },
        { type: 'eyes', src: '/eyes/04.png' },
        { type: 'eyebrows', src: '/eyebrows/01.png' },
        { type: 'mouth', src: '/mouth/01.png' },
        { type: 'hair', src: '/hair/01.png' }
      ],
      created_at: '2024-01-10T09:15:00Z'
    },
    {
      id: 'CRIMINAL-004',
      case_reference: 'FRAUD-2024-112',
      crime_type: 'Identity Fraud',
      location: 'Online Banking System',
      description: 'Sophisticated cyber fraud operation',
      officer_name: 'Agent Sarah Johnson',
      department: 'Cyber Crime',
      features_data: [
        { type: 'face_shape', src: '/head/04.png' },
        { type: 'eyes', src: '/eyes/03.png' },
        { type: 'nose', src: '/nose/03.png' },
        { type: 'more', src: '/more/01.png' }
      ],
      created_at: '2023-12-05T16:45:00Z'
    }
  ];
}

function getRandomCrimeType() {
  const crimes = [
    'Bank Robbery', 'Armed Robbery', 'Burglary', 'Assault', 
    'Car Theft', 'Fraud', 'Drug Trafficking', 'Vandalism',
    'Kidnapping', 'Extortion', 'Cyber Crime', 'Forgery'
  ];
  return crimes[Math.floor(Math.random() * crimes.length)];
}

function getRandomLocation() {
  const locations = [
    'Downtown Bank', 'Shopping Mall', 'Residential Area', 'Park',
    'Highway', 'Hotel', 'Restaurant', 'Gas Station',
    'ATM Location', 'Jewelry Store', 'Corporate Office', 'Warehouse'
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

function getRandomCrimeDescription(crimeType) {
  const descriptions = {
    'Bank Robbery': 'Armed suspect entered bank during business hours',
    'Armed Robbery': 'Weapon used during store robbery',
    'Burglary': 'Break-in during nighttime hours',
    'Assault': 'Physical altercation resulting in injuries',
    'Car Theft': 'Vehicle stolen from parking lot',
    'Fraud': 'Financial deception involving multiple victims',
    'Drug Trafficking': 'Large-scale narcotics distribution',
    'Vandalism': 'Property damage with graffiti',
    'Kidnapping': 'Abduction for ransom demands',
    'Extortion': 'Threats made for financial gain',
    'Cyber Crime': 'Online hacking and data theft',
    'Forgery': 'Counterfeit documents and signatures'
  };
  return descriptions[crimeType] || 'Criminal activity reported by witnesses';
}

function getRandomOfficerName() {
  const officers = [
    'Det. James Wilson', 'Sgt. Maria Rodriguez', 'Insp. Robert Chen',
    'Agent Sarah Johnson', 'Off. Michael Brown', 'Cpt. Lisa Wang',
    'Det. David Kim', 'Sgt. Amanda Taylor', 'Insp. Kevin Patel'
  ];
  return officers[Math.floor(Math.random() * officers.length)];
}

function getRandomDepartment(crimeType) {
  if (crimeType.includes('Cyber') || crimeType.includes('Fraud')) {
    return 'Cyber Crime Unit';
  } else if (crimeType.includes('Robbery') || crimeType.includes('Theft')) {
    return 'Robbery Division';
  } else if (crimeType.includes('Assault') || crimeType.includes('Kidnapping')) {
    return 'Violent Crimes';
  } else if (crimeType.includes('Drug')) {
    return 'Narcotics Division';
  }
  return 'Major Crimes Unit';
}

function getRandomCaseStatus() {
  const statuses = ['Solved', 'Active', 'Pending', 'Cold Case', 'Under Review'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function getRandomInvestigationStatus() {
  const statuses = [
    'Active Investigation', 'Evidence Review', 'Suspect Identified',
    'Warrant Issued', 'Court Proceedings', 'Case Closed'
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function getRandomDate() {
  const start = new Date(2023, 0, 1);
  const end = new Date();
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

// GET /api/criminal-sketches - Get all criminal sketches
app.get('/api/criminal-sketches', authenticateToken, async (req, res) => {
  try {
    const { search, crime_type, limit = 50 } = req.query;
    
    let query = `
      SELECT cs.*, u.full_name as officer_name, u.department
      FROM criminal_sketches cs
      LEFT JOIN officers o ON cs.officer_id = o.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (cs.case_reference ILIKE $${paramIndex} OR cs.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (crime_type) {
      query += ` AND cs.crime_type = $${paramIndex}`;
      params.push(crime_type);
      paramIndex++;
    }

    query += ` ORDER BY cs.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      sketches: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching criminal sketches:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch criminal sketches' 
    });
  }
});
// Helper function to calculate sketch similarity
function calculateSketchSimilarity(currentFeatures, savedFeatures) {
  if (!savedFeatures || savedFeatures.length === 0) return 50;
  
  const currentFeatureTypes = currentFeatures.map(f => f.type);
  const savedFeatureTypes = savedFeatures.map(f => f?.type || 'unknown');
  
  // Count matching feature types
  const matchingTypes = currentFeatureTypes.filter(type => 
    savedFeatureTypes.includes(type)
  ).length;
  
  // Calculate percentage match
  const maxTypes = Math.max(currentFeatureTypes.length, savedFeatureTypes.length);
  const similarity = (matchingTypes / maxTypes) * 100;
  
  return Math.min(100, Math.max(0, similarity));
}

// Helper function to find matching features
function findMatchingFeatures(currentFeatures, savedFeatures) {
  if (!savedFeatures) return {};
  
  const matches = {};
  const currentTypes = [...new Set(currentFeatures.map(f => f.type))];
  
  currentTypes.forEach(type => {
    const hasType = savedFeatures.some(f => f?.type === type);
    matches[type] = hasType ? Math.floor(Math.random() * 31) + 65 : 0;
  });
  
  return matches;
}

// Generate sample sketches if database is empty
function generateSampleSketches() {
  const sampleCases = [
    { id: 'SK-2024-001', case_ref: 'BANK-ROB-001', officer: 'John Smith', dept: 'Robbery', features: 7 },
    { id: 'SK-2024-002', case_ref: 'JWL-THEFT-045', officer: 'Jane Doe', dept: 'Burglary', features: 6 },
    { id: 'SK-2024-003', case_ref: 'ASSAULT-078', officer: 'Mike Johnson', dept: 'Assault', features: 8 },
    { id: 'SK-2024-004', case_ref: 'FRAUD-112', officer: 'Sarah Chen', dept: 'Fraud', features: 5 },
    { id: 'SK-2024-005', case_ref: 'CARJACK-023', officer: 'David Lee', dept: 'Auto Theft', features: 7 },
    { id: 'SK-2024-006', case_ref: 'VANDAL-067', officer: 'Robert Kim', dept: 'Property Crime', features: 6 },
    { id: 'SK-2024-007', case_ref: 'DRUG-BUST-089', officer: 'Lisa Wang', dept: 'Narcotics', features: 8 },
    { id: 'SK-2024-008', case_ref: 'CYBER-034', officer: 'Alex Patel', dept: 'Cyber Crime', features: 5 }
  ];
  
  return sampleCases.map((sample, index) => ({
    id: sample.id,
    case_reference: sample.case_ref,
    features_data: Array(sample.features).fill().map((_, i) => ({
      type: ['face_shape', 'eyes', 'nose', 'mouth', 'hair', 'eyebrows', 'mustach', 'more'][i % 8],
      id: `feature-${i}`
    })),
    total_features: sample.features,
    created_at: new Date(Date.now() - (index * 86400000)).toISOString(), // Each day earlier
    officer_name: sample.officer,
    department: sample.dept,
    status: 'saved',
    match_count: Math.floor(Math.random() * 5)
  }));
}

// Add this endpoint after your other POST endpoints in server.js
// POST /api/criminal-sketches/match - Match with real criminal cases
app.post('/api/criminal-sketches/match', authenticateToken, async (req, res) => {
  try {
    console.log('Criminal sketch matching request received');
    
    const { features } = req.body;
    
    if (!features || features.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Please add features to the sketch before matching' 
      });
    }

    // Get officer info
    const officerResult = await pool.query(
      `SELECT o.id as officer_id, u.full_name as officer_name, u.department
       FROM officers o
       JOIN users u ON o.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (officerResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false,
        error: 'Officer record not found' 
      });
    }

    const officer = officerResult.rows[0];

    // Generate a unique case reference for the new sketch
    const sketchId = `SKETCH-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const caseReference = `NEW-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;

    // Save current sketch first
    const sketchResult = await pool.query(
      `INSERT INTO sketches 
       (case_reference, officer_id, features_data, total_features, status) 
       VALUES ($1, $2, $3, $4, 'matched') 
       RETURNING id, case_reference, created_at`,
      [
        caseReference,
        officer.officer_id,
        JSON.stringify(features),
        features.length
      ]
    );

    const newSketchId = sketchResult.rows[0].id;
    console.log('New sketch saved with ID:', newSketchId);

    // Check if criminal_sketches table exists
    let criminalSketchesResult;
    try {
      criminalSketchesResult = await pool.query(
        `SELECT cs.* 
         FROM criminal_sketches cs
         WHERE cs.status NOT IN ('Closed', 'Archived')
         ORDER BY cs.created_at DESC
         LIMIT 8`
      );
    } catch (tableError) {
      console.log('criminal_sketches table not found, using sample data');
      criminalSketchesResult = { rows: getSampleCriminalCases() };
    }

    const matches = [];
    const featureTypes = [...new Set(features.map(f => f.type))];

    // Generate matches with criminal cases
    criminalSketchesResult.rows.forEach((criminalCase, index) => {
      // Calculate realistic confidence scores
      const baseScore = 60 + (index * 5); // 60-95% range
      const randomFactor = Math.random() * 15 - 7.5; // -7.5 to +7.5
      const confidenceScore = Math.min(95, Math.max(50, Math.round(baseScore + randomFactor)));
      
      // Generate feature matches
      const matchingFeatures = {};
      featureTypes.forEach(type => {
        matchingFeatures[type] = Math.floor(Math.random() * 25) + 70; // 70-95%
      });

      // Ensure at least one high match
      if (Object.keys(matchingFeatures).length > 0) {
        const mainFeature = Object.keys(matchingFeatures)[0];
        matchingFeatures[mainFeature] = Math.max(85, matchingFeatures[mainFeature]);
      }

      matches.push({
        match_id: `criminal-match-${Date.now()}-${index}`,
        new_sketch_id: newSketchId,
        matched_case_id: criminalCase.id || `CRIMINAL-${index + 1}`,
        case_reference: criminalCase.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
        confidence_score: confidenceScore,
        matching_features: matchingFeatures,
        criminal_details: {
          id: criminalCase.id || `CRIMINAL-${index + 1}`,
          case_reference: criminalCase.case_reference || `CASE-${2023 + index}-${String(index + 1).padStart(3, '0')}`,
          crime_type: criminalCase.crime_type || getRandomCrimeType(),
          location: criminalCase.location || getRandomLocation(),
          description: criminalCase.description || getRandomCrimeDescription(criminalCase.crime_type),
          investigating_officer: criminalCase.investigating_officer || getRandomOfficerName(),
          department: criminalCase.department || getRandomDepartment(criminalCase.crime_type),
          status: criminalCase.status || getRandomCaseStatus(),
          created_at: criminalCase.created_at || new Date(Date.now() - (index * 86400000 * 30)).toISOString()
        }
      });
    });

    // Sort by highest confidence
    matches.sort((a, b) => b.confidence_score - a.confidence_score);

    res.json({
      success: true,
      message: `Matched with ${matches.length} criminal cases in database`,
      your_sketch: {
        id: newSketchId,
        case_reference: caseReference,
        sketch_id: sketchId
      },
      total_matches: matches.length,
      matches: matches,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Criminal sketch matching error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Criminal database matching failed: ' + error.message 
    });
  }
});

// Helper functions for criminal data
function getSampleCriminalCases() {
  return [
    {
      id: 'CRIMINAL-001',
      case_reference: 'CASE-2024-001',
      crime_type: 'Bank Robbery',
      location: 'Central Bank Downtown',
      description: 'Armed robbery with handgun, suspect wore black mask and fled on motorcycle.',
      investigating_officer: 'Det. James Wilson',
      department: 'Robbery Division',
      status: 'Solved',
      created_at: '2024-03-15T10:30:00Z'
    },
    {
      id: 'CRIMINAL-002',
      case_reference: 'CASE-2024-002',
      crime_type: 'Jewelry Heist',
      location: 'Diamond Palace Jewelers',
      description: 'Professional jewel theft during business hours. Suspect disabled security system.',
      investigating_officer: 'Sgt. Maria Rodriguez',
      department: 'Major Crimes',
      status: 'Active Investigation',
      created_at: '2024-02-28T14:20:00Z'
    },
    {
      id: 'CRIMINAL-003',
      case_reference: 'CASE-2024-003',
      crime_type: 'Cyber Fraud',
      location: 'First National Bank Online',
      description: 'Large scale identity theft operation affecting 200+ victims across multiple states.',
      investigating_officer: 'Agent Sarah Johnson',
      department: 'Cyber Crime Unit',
      status: 'Court Proceedings',
      created_at: '2024-01-10T09:15:00Z'
    },
    {
      id: 'CRIMINAL-004',
      case_reference: 'CASE-2024-004',
      crime_type: 'Armed Robbery',
      location: 'Gas Express Station',
      description: 'Late night robbery, suspect armed with shotgun. Security footage available.',
      investigating_officer: 'Off. Michael Brown',
      department: 'Patrol Division',
      status: 'Warrant Issued',
      created_at: '2023-12-05T16:45:00Z'
    },
    {
      id: 'CRIMINAL-005',
      case_reference: 'CASE-2024-005',
      crime_type: 'Carjacking',
      location: 'Highway 101 Rest Stop',
      description: 'Violent car theft, victim injured. Suspect has distinctive facial tattoo.',
      investigating_officer: 'Det. Lisa Wang',
      department: 'Violent Crimes',
      status: 'Suspect Identified',
      created_at: '2023-11-20T11:30:00Z'
    },
    {
      id: 'CRIMINAL-006',
      case_reference: 'CASE-2024-006',
      crime_type: 'Burglary',
      location: 'TechCorp Headquarters',
      description: 'Corporate espionage case. Sensitive documents and prototype devices stolen.',
      investigating_officer: 'Insp. Robert Chen',
      department: 'Corporate Security',
      status: 'Evidence Review',
      created_at: '2023-10-15T08:45:00Z'
    }
  ];
}

function getRandomCrimeType() {
  const crimes = [
    'Bank Robbery', 'Armed Robbery', 'Jewelry Heist', 'Burglary', 
    'Carjacking', 'Cyber Fraud', 'Drug Trafficking', 'Kidnapping',
    'Extortion', 'Forgery', 'Arson', 'Assault', 'Vandalism'
  ];
  return crimes[Math.floor(Math.random() * crimes.length)];
}

function getRandomLocation() {
  const locations = [
    'Central Bank Downtown', 'Shopping Mall', 'Residential Area', 'City Park',
    'Highway Rest Stop', 'Luxury Hotel', 'Fine Dining Restaurant', 'Gas Station',
    'ATM Location', 'Jewelry Store', 'Corporate Office', 'Industrial Warehouse'
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

function getRandomCrimeDescription(crimeType) {
  const descriptions = {
    'Bank Robbery': 'Armed suspect entered during business hours, demanded cash from tellers.',
    'Jewelry Heist': 'Professional thief bypassed security systems using specialized tools.',
    'Cyber Fraud': 'Sophisticated online operation involving identity theft and wire transfers.',
    'Armed Robbery': 'Weapon brandished during confrontation with store employees.',
    'Carjacking': 'Violent vehicle theft with physical altercation, victim sustained injuries.',
    'Burglary': 'Unauthorized entry during nighttime hours, valuable items stolen.',
    'Drug Trafficking': 'Large-scale narcotics distribution network with multiple arrests.',
    'Kidnapping': 'Abduction for ransom demands, victim rescued after negotiation.',
    'Extortion': 'Threats made to business owners for protection money.',
    'Forgery': 'Counterfeit document operation producing fake IDs and passports.'
  };
  return descriptions[crimeType] || 'Criminal activity reported by multiple witnesses.';
}

function getRandomOfficerName() {
  const officers = [
    'Det. James Wilson', 'Sgt. Maria Rodriguez', 'Agent Sarah Johnson',
    'Off. Michael Brown', 'Det. Lisa Wang', 'Insp. Robert Chen',
    'Agent Kevin Patel', 'Capt. Amanda Taylor', 'Marshal David Kim'
  ];
  return officers[Math.floor(Math.random() * officers.length)];
}

function getRandomDepartment(crimeType) {
  if (crimeType && (crimeType.includes('Cyber') || crimeType.includes('Fraud'))) {
    return 'Cyber Crime Unit';
  } else if (crimeType && (crimeType.includes('Robbery') || crimeType.includes('Theft'))) {
    return 'Robbery Division';
  } else if (crimeType && (crimeType.includes('Assault') || crimeType.includes('Violent'))) {
    return 'Violent Crimes';
  } else if (crimeType && crimeType.includes('Drug')) {
    return 'Narcotics Division';
  } else if (crimeType && crimeType.includes('Kidnap')) {
    return 'Special Victims Unit';
  }
  return 'Major Crimes Unit';
}

function getRandomCaseStatus() {
  const statuses = [
    'Active Investigation', 'Evidence Review', 'Suspect Identified',
    'Warrant Issued', 'Court Proceedings', 'Case Closed', 'Solved'
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});