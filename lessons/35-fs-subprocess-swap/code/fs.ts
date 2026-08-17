/** fs 能力缝：Definition（接口）。 */

export interface FsService {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  list(dir: string): Promise<string[]>
}
