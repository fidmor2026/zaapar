const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379,
  password: process.env.REDIS_PASS || undefined
};

const client = new Redis(connection);
const queue = new Queue('zaapar-jobs', { connection });
module.exports = { queue, client };