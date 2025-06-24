/*
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(100) REFERENCES users(email),
  name VARCHAR(255),
  total INTEGER,
  file_path TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP
);
*/