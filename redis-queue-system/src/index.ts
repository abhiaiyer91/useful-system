import { Queue, Worker } from "bullmq";

export class RedisWorkerQueueSystem {
  redis: any;
  constructor({ redis }) {
    this.redis = redis;
  }

  workerQueue({
    queueName,
    options = {},
    processor,
  }: {
    queueName: string;
    options: any;
    processor?: any;
  }) {
    const queue = new Worker(queueName, processor, {
      ...options,
      connection: this.redis,
    });

    queue.on("completed", (job) => {
      console.log(`${job.id} has completed!`);
    });

    queue.on("failed", (job, err) => {
      console.log(`${job?.id} has failed with ${err.message}`);
    });

    queue.on("error", (err) => {
      // log the error
      console.error(err);
    });

    console.log(queue.isRunning());

    return queue;
  }

  producerQueue({
    queueName,
    options = {},
  }: {
    queueName: string;
    options: any;
  }) {
    return new Queue(queueName, {
      ...options,
      connection: this.redis,
    });
  }
}
