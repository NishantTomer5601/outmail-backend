import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Add retry configuration for better reliability
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// Helper to get S3 key from a full S3 URL
export function getS3KeyFromUrl(url) {
  try {
    console.log("utl: ", url)
    const urlObject = new URL(url);
    console.log("url_object: ", urlObject);
    
    return urlObject.pathname.substring(1);
  } catch (error) {
    console.log("fat gya: ", url);
    
    return url.split('.amazonaws.com/')[1];
  }
}

export async function uploadAttachmentToS3(fileBuffer, fileName, mimetype) {
  const bucket = process.env.S3_BUCKET;
  const key = `attachments/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });
  await s3.send(command);
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function uploadCsvToS3(fileBuffer, fileName, mimetype) {
  const bucket = process.env.S3_BUCKET;
  const key = `csv-uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });
  await s3.send(command);
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function deleteAttachmentFromS3(s3Url) {
  const bucket = process.env.S3_BUCKET;
  const key = getS3KeyFromUrl(s3Url);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ✅ Exported helper to get file buffer from S3
// ...existing code...
export async function getS3FileBuffer(s3UrlOrStream) {
  // If it's already a stream (from getS3Object), just process it directly
  if (s3UrlOrStream && typeof s3UrlOrStream.pipe === 'function') {
    const chunks = [];
    for await (const chunk of s3UrlOrStream) {
      chunks.push(chunk);
    }
    return { buffer: Buffer.concat(chunks) };
  }
  
  // Otherwise, treat it as a URL and fetch from S3
  const bucket = process.env.S3_BUCKET;
  const key = getS3KeyFromUrl(s3UrlOrStream);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return { buffer: Buffer.concat(chunks) };
}

export async function getS3Object(s3Url) {
  const bucket = process.env.S3_BUCKET;
  const key = getS3KeyFromUrl(s3Url);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await s3.send(command);
}