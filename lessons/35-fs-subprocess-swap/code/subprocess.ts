/** subprocess 能力缝：Definition（接口）。 */

export interface SubprocessService {
  exec(command: string): Promise<string>
}
