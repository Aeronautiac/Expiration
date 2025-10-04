export default class ExecutionQueue {
    private tasks: Array<() => Promise<void>> = [];
    private running: boolean = false;

    // add a callback to the execution queue
    executeQueued<T>(callback: () => Promise<T>): Promise<T> {
        // return a new promise that resolves when the task is completed
        return new Promise<T>((resolve, reject) => {
            // create a task
            // this task will resolve the new promise when it is executed
            // the promise will resolve with the result of the user's callback
            const task = async () => {
                try {
                    const result = await callback();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            // queue the task to be executed
            this.tasks.push(task);

            // execute the tasks in the queue
            this.executeTasks();
        });
    }

    // execute the tasks in the queue
    private async executeTasks() {
        // tasks must be ran sequentially
        if (this.running) return;
        this.running = true;

        // execute all tasks in sequence
        while (this.tasks.length > 0) {
            const task = this.tasks.shift();
            await task();
        }

        // executions are complete
        this.running = false;
    }
}
