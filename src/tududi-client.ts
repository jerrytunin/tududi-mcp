import axios, { AxiosInstance } from 'axios';
import { normalizeTududiApiUrl } from './config.js';
import { logger } from './logger.js';
import {
  CreateAreaInput,
  CreateProjectInput,
  CreateTaskInput,
  SearchTasksParams,
  TududuArea,
  TududuProject,
  TududuTask,
  UpdateTaskInput,
} from './types.js';

const PRIORITY_MAP: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function unwrapList<T>(data: T[] | Record<string, unknown>, key: string): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  const nested = data?.[key];
  return Array.isArray(nested) ? (nested as T[]) : [];
}

function formatCookieHeader(setCookie: string | string[]): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0].trim()).join('; ');
}

// Tududi 1.1+ expects snake_case fields with `name` instead of `title` and `note` instead of `description`
function mapTaskInput(input: CreateTaskInput | UpdateTaskInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.name = input.title;
  if (input.description !== undefined) out.note = input.description;
  if (input.projectId !== undefined) out.project_id = input.projectId;
  if (input.areaId !== undefined) out.area_id = input.areaId;
  if (input.dueDate !== undefined) out.due_date = input.dueDate;
  if (input.priority !== undefined) {
    out.priority = PRIORITY_MAP[input.priority] ?? input.priority;
  }
  if ('completed' in input && input.completed !== undefined) {
    out.status = input.completed ? 'done' : 'not_started';
  }
  if (Array.isArray(input.tags)) {
    out.tags = input.tags;
  }
  return out;
}

function mapProjectInput(input: CreateProjectInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.description = input.description;
  if (input.areaId !== undefined) out.area_id = input.areaId;
  if (input.color !== undefined) out.color = input.color;
  return out;
}

export class TududuClient {
  private client: AxiosInstance;
  private sessionCookie?: string;
  private readonly hasApiKey: boolean;
  private readonly email?: string;
  private readonly password?: string;
  private loginPromise?: Promise<void>;
  private isAuthenticated = false;

  constructor(apiUrl: string, apiKey?: string, email?: string, password?: string) {
    this.hasApiKey = Boolean(apiKey);
    this.email = email;
    this.password = password;

    this.client = axios.create({
      baseURL: normalizeTududiApiUrl(apiUrl),
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    });

    if (apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    }

    this.client.interceptors.request.use(async (reqConfig) => {
      if (reqConfig.url !== '/api/v1/login') {
        await this.ensureAuthenticated();
        if (this.sessionCookie && reqConfig.headers) {
          if (typeof reqConfig.headers.set === 'function') {
            reqConfig.headers.set('Cookie', this.sessionCookie);
          } else {
            (reqConfig.headers as Record<string, string>)['Cookie'] = this.sessionCookie;
          }
        }
      }
      return reqConfig;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({ error: error.message }, 'Tududi API error');
        throw error;
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.hasApiKey || this.isAuthenticated || !this.email || !this.password) {
      return;
    }
    if (!this.loginPromise) {
      this.loginPromise = this.login(this.email, this.password).catch((error) => {
        this.loginPromise = undefined;
        throw error;
      });
    }
    await this.loginPromise;
  }

  private async login(email: string, password: string): Promise<void> {
    try {
      const response = await this.client.post('/api/v1/login', { email, password });
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        this.sessionCookie = formatCookieHeader(setCookie);
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
      }
      this.isAuthenticated = true;
      logger.info('Successfully logged in to Tududi');
    } catch (error) {
      logger.error({ error }, 'Failed to login to Tududi');
      throw new Error('Failed to authenticate with Tududi');
    }
  }

  // Tasks
  async listTasks(): Promise<TududuTask[]> {
    const response = await this.client.get<TududuTask[] | Record<string, unknown>>('/api/v1/tasks');
    return unwrapList<TududuTask>(response.data, 'tasks');
  }

  async getTask(id: string): Promise<TududuTask> {
    const response = await this.client.get<TududuTask>(`/api/v1/task/${encodeURIComponent(id)}`);
    return response.data;
  }

  async createTask(input: CreateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input);
    const response = await this.client.post<TududuTask>('/api/v1/task', body);
    return response.data;
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<TududuTask> {
    const body = mapTaskInput(input);
    const response = await this.client.patch<TududuTask>(
      `/api/v1/task/${encodeURIComponent(id)}`,
      body
    );
    return response.data;
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/v1/task/${encodeURIComponent(id)}`);
  }

  async completeTask(id: string): Promise<TududuTask> {
    return this.updateTask(id, { completed: true });
  }

  async searchTasks(params: SearchTasksParams): Promise<TududuTask[]> {
    const query = params.query?.trim();
    const qp: Record<string, unknown> = {};

    if (query) {
      qp.q = query;
      qp.filters = 'Task';
      if (params.completed !== undefined) {
        qp.status = params.completed ? 'completed' : 'active';
      }
      if (params.priority !== undefined) {
        qp.priority = params.priority;
      }
      if (Array.isArray(params.tags) && params.tags.length > 0) {
        qp.tags = params.tags.join(',');
      }
      if (params.projectId && !isNumericId(params.projectId)) {
        qp.project_uid = params.projectId.trim();
      }
      if (params.areaId && !isNumericId(params.areaId)) {
        qp.area_uid = params.areaId.trim();
      }

      const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
        '/api/v1/search',
        { params: qp }
      );
      const data = response.data;
      let results: TududuTask[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? (data.results as TududuTask[])
          : unwrapList<TududuTask>(data, 'tasks');

      if (params.projectId && isNumericId(params.projectId)) {
        const targetProjectId = params.projectId.trim();
        results = results.filter((task) => {
          const projectObj = task.Project as { id?: string | number } | undefined;
          const idValue = task.project_id ?? task.projectId ?? projectObj?.id;
          return idValue !== undefined && idValue !== null && String(idValue) === targetProjectId;
        });
      }

      if (params.areaId && isNumericId(params.areaId)) {
        const targetAreaId = params.areaId.trim();
        results = results.filter((task) => {
          const areaObj = task.Area as { id?: string | number } | undefined;
          const idValue = task.area_id ?? task.areaId ?? areaObj?.id;
          return idValue !== undefined && idValue !== null && String(idValue) === targetAreaId;
        });
      }

      return results;
    }

    if (params.projectId) {
      const projectId = params.projectId.trim();
      if (isNumericId(projectId)) {
        qp.project_id = projectId;
      } else {
        qp.project_uid = projectId;
      }
    }
    if (params.areaId) {
      const areaId = params.areaId.trim();
      if (isNumericId(areaId)) {
        qp.area_id = areaId;
      } else {
        qp.area_uid = areaId;
      }
    }
    if (params.completed !== undefined) {
      qp.status = params.completed ? 'done' : 'active';
    }
    if (params.priority !== undefined) {
      qp.priority = params.priority;
    }
    if (Array.isArray(params.tags) && params.tags.length > 0) {
      qp.tags = params.tags.join(',');
    }

    const response = await this.client.get<TududuTask[] | Record<string, unknown>>(
      '/api/v1/tasks',
      { params: qp }
    );
    return unwrapList<TududuTask>(response.data, 'tasks');
  }

  // Projects
  async listProjects(): Promise<TududuProject[]> {
    const response = await this.client.get<TududuProject[] | Record<string, unknown>>(
      '/api/v1/projects'
    );
    return unwrapList<TududuProject>(response.data, 'projects');
  }

  async getProject(id: string): Promise<TududuProject> {
    const response = await this.client.get<TududuProject>(
      `/api/v1/project/${encodeURIComponent(id)}`
    );
    return response.data;
  }

  async createProject(input: CreateProjectInput): Promise<TududuProject> {
    const body = mapProjectInput(input);
    const response = await this.client.post<TududuProject>('/api/v1/project', body);
    return response.data;
  }

  // Areas
  async listAreas(): Promise<TududuArea[]> {
    const response = await this.client.get<TududuArea[] | Record<string, unknown>>('/api/v1/areas');
    return unwrapList<TududuArea>(response.data, 'areas');
  }

  async getArea(id: string): Promise<TududuArea> {
    const response = await this.client.get<TududuArea>(`/api/v1/areas/${encodeURIComponent(id)}`);
    return response.data;
  }

  async createArea(input: CreateAreaInput): Promise<TududuArea> {
    const response = await this.client.post<TududuArea>('/api/v1/areas', input);
    return response.data;
  }
}
