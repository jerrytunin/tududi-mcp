import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';
import {
  TududuTask,
  TududuProject,
  TududuArea,
  CreateTaskInput,
  UpdateTaskInput,
  CreateProjectInput,
  CreateAreaInput,
  SearchTasksParams,
} from './types.js';

// Tududi 1.1+ expects snake_case names with `name` instead of `title`
function mapTaskInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('title' in input && input.title !== undefined) out.name = input.title;
  if ('description' in input && input.description !== undefined) out.note = input.description;
  if ('projectId' in input && input.projectId !== undefined) out.project_id = input.projectId;
  if ('dueDate' in input && input.dueDate !== undefined) out.due_date = input.dueDate;
  if ('priority' in input && input.priority !== undefined) {
    const map: Record<string, number> = { low: 0, medium: 1, high: 2 };
    out.priority = typeof input.priority === 'string' ? map[input.priority as string] ?? input.priority : input.priority;
  }
  if ('completed' in input && input.completed !== undefined) {
    out.status = input.completed ? 'done' : 'not_started';
  }
  if ('tags' in input && Array.isArray(input.tags)) out.tags = input.tags;
  return out;
}

function mapProjectInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in input && input.name !== undefined) out.name = input.name;
  if ('description' in input && input.description !== undefined) out.description = input.description;
  if ('areaId' in input && input.areaId !== undefined) out.area_id = input.areaId;
  if ('color' in input && input.color !== undefined) out.color = input.color;
  return out;
}

export class TududuClient {
  private client: AxiosInstance;
  private sessionCookie?: string;

  constructor(apiUrl: string, apiKey?: string, email?: string, password?: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    });
    if (apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    }
    if (email && password && !apiKey) {
      this.login(email, password).catch((error) => {
        logger.error({ error: error.message }, 'Failed to login to Tududi');
        throw error;
      });
    }
    this.client.interceptors.response.use(
      (r) => r,
      (e) => {
        logger.error({ error: e.message }, 'Tududi API error');
        throw e;
      }
    );
  }

  private async login(email: string, password: string): Promise<void> {
    const response = await this.client.post('/api/login', { email, password });
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      this.sessionCookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
    }
    logger.info('Successfully logged in to Tududi');
  }

  // Tasks
  async listTasks(): Promise<TududuTask[]> {
    return (await this.client.get<TududuTask[]>('/api/tasks')).data;
  }

  async getTask(id: string): Promise<TududuTask> {
    return (await this.client.get<TududuTask>(`/api/task/${id}`)).data;
  }

  async createTask(input: CreateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input as unknown as Record<string, unknown>);
    return (await this.client.post<TududuTask>('/api/task', body)).data;
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input as unknown as Record<string, unknown>);
    return (await this.client.patch<TududuTask>(`/api/task/${id}`, body)).data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/task/${id}`);
  }

  async completeTask(id: string): Promise<TududuTask> {
    return this.updateTask(id, { completed: true } as UpdateTaskInput);
  }

  async searchTasks(params: SearchTasksParams): Promise<TududuTask[]> {
    // Tududi 1.1+: GET /api/tasks?search=...&project_id=...&area_id=...&status=&priority=
    const p = params as Record<string, unknown> & { query?: string };
    const qp: Record<string, unknown> = {};
    if (p.query !== undefined) qp.search = p.query;
    if (p.projectId !== undefined) qp.project_id = p.projectId;
    if (p.areaId !== undefined) qp.area_id = p.areaId;
    if (p.completed !== undefined) qp.status = p.completed ? 'done' : 'not_started';
    if (p.priority !== undefined) {
      const map: Record<string, number> = { low: 0, medium: 1, high: 2 };
      qp.priority = typeof p.priority === 'string' ? map[p.priority as string] ?? p.priority : p.priority;
    }
    if (Array.isArray(p.tags)) qp.tags = (p.tags as string[]).join(',');
    return (await this.client.get<TududuTask[]>('/api/tasks', { params: qp })).data;
  }

  // Projects
  async listProjects(): Promise<TududuProject[]> {
    return (await this.client.get<TududuProject[]>('/api/projects')).data;
  }

  async getProject(id: string): Promise<TududuProject> {
    return (await this.client.get<TududuProject>(`/api/project/${id}`)).data;
  }

  async createProject(input: CreateProjectInput): Promise<TududuProject> {
    const body = mapProjectInput(input as unknown as Record<string, unknown>);
    return (await this.client.post<TududuProject>('/api/project', body)).data;
  }

  // Areas
  async listAreas(): Promise<TududuArea[]> {
    return (await this.client.get<TududuArea[]>('/api/areas')).data;
  }

  async getArea(id: string): Promise<TududuArea> {
    return (await this.client.get<TududuArea>(`/api/areas/${id}`)).data;
  }

  async createArea(input: CreateAreaInput): Promise<TududuArea> {
    return (await this.client.post<TududuArea>('/api/areas', input)).data;
  }
}
