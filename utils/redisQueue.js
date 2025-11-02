import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export class SimpleQueue {
  constructor(name) {
    this.name = name;
    this.queueKey = `queue:${name}`;
    this.processingKey = `processing:${name}`;
  }

  async add(jobName, data, options = {}) {
    const job = {
      id: `${this.name}:${Date.now()}:${Math.random()}`,
      name: jobName,
      data,
      createdAt: new Date().toISOString(),
      delay: options.delay || 0
    };

    if (options.delay && options.delay > 0) {
      const processAt = Date.now() + options.delay;
      await redis.zadd(`delayed:${this.name}`, processAt, JSON.stringify(job));
    } else {
      await redis.lpush(this.queueKey, JSON.stringify(job));
    }

    return job;
  }

  async addBulk(jobs) {
    const pipeline = redis.pipeline();
    
    jobs.forEach(({ name, data, opts = {} }) => {
      const job = {
        id: `${this.name}:${Date.now()}:${Math.random()}`,
        name,
        data,
        createdAt: new Date().toISOString(),
        delay: opts.delay || 0
      };

      if (opts.delay && opts.delay > 0) {
        const processAt = Date.now() + opts.delay;
        pipeline.zadd(`delayed:${this.name}`, processAt, JSON.stringify(job));
      } else {
        pipeline.lpush(this.queueKey, JSON.stringify(job));
      }
    });

    await pipeline.exec();
  }

  async process(processor) {
    console.log(`[${this.name} Worker] Starting to process jobs...`);
    
    // Process delayed jobs
    setInterval(async () => {
      await this.processDelayedJobs();
    }, 10000); // Check every 10 seconds

    // Main processing loop
    while (true) {
      try {
        const result = await redis.brpop(this.queueKey, 5); // 5 second timeout
        
        if (result) {
          const [, jobData] = result;
          const job = JSON.parse(jobData);
          
          // Move to processing
          await redis.lpush(this.processingKey, jobData);
          
          try {
            await processor(job);
            // Remove from processing on success
            await redis.lrem(this.processingKey, 1, jobData);
          } catch (error) {
            console.error(`[${this.name} Worker] Job ${job.id} failed:`, error.message);
            // Remove from processing on failure (you could implement retry logic here)
            await redis.lrem(this.processingKey, 1, jobData);
          }
        }
      } catch (error) {
        console.error(`[${this.name} Worker] Error:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
      }
    }
  }

  async processDelayedJobs() {
    const now = Date.now();
    const delayedJobs = await redis.zrangebyscore(`delayed:${this.name}`, 0, now);
    
    if (delayedJobs.length > 0) {
      const pipeline = redis.pipeline();
      
      delayedJobs.forEach(jobData => {
        pipeline.lpush(this.queueKey, jobData);
        pipeline.zrem(`delayed:${this.name}`, jobData);
      });
      
      await pipeline.exec();
    }
  }

  async getStats() {
    const waiting = await redis.llen(this.queueKey);
    const processing = await redis.llen(this.processingKey);
    const delayed = await redis.zcard(`delayed:${this.name}`);
    
    return { waiting, processing, delayed };
  }
}

export const emailQueue = new SimpleQueue('emailQueue');
export const parsingQueue = new SimpleQueue('parsingQueue');