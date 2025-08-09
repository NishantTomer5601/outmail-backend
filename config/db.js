import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Set to true if using SSL
});

export const connectDB = async () => {
  try {
    await pool.connect();
    console.log('PostgreSQL connected successfully');
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
    process.exit(1);
  }
};

export default pool;