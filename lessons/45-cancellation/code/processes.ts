/** 进程树清理：跟踪子进程、整组杀掉（第 45 课，教学版）。 */

export interface TrackedProcess {
  pid: number
  kill(signal?: string): boolean
}

export class ProcessTracker {
  private readonly processes = new Map<number, TrackedProcess>()

  track(process: TrackedProcess): () => void {
    this.processes.set(process.pid, process)
    return () => this.processes.delete(process.pid)
  }

  killAll(signal = 'SIGTERM'): number {
    let killed = 0
    for (const process of [...this.processes.values()]) {
      if (process.kill(signal)) killed += 1
    }
    this.processes.clear()
    return killed
  }

  get size(): number {
    return this.processes.size
  }
}
