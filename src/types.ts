/**
 * Tududi API Types
 */

export interface TududuTaskTag {
  id?: number | string;
  uid?: string;
  name: string;
  color?: string;
}

export interface TududuTask {
  id: string | number;
  uid?: string;
  name?: string;
  title?: string;
  note?: string;
  description?: string;
  status?: string | number;
  completed?: boolean;
  projectId?: string;
  project_id?: string | number | null;
  project_uid?: string | null;
  areaId?: string;
  area_id?: string | number | null;
  area_uid?: string | null;
  dueDate?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | number;
  tags?: Array<string | TududuTaskTag>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TududuProject {
  id: string | number;
  uid?: string;
  name: string;
  description?: string;
  areaId?: string;
  area_id?: string | number | null;
  color?: string;
  status?: string;
  archived?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TududuArea {
  id: string | number;
  uid?: string;
  name: string;
  description?: string;
  color?: string;
  archived?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId?: string;
  areaId?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  completed?: boolean;
  projectId?: string;
  areaId?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  areaId?: string;
  color?: string;
}

export interface CreateAreaInput {
  name: string;
  description?: string;
  color?: string;
}

export interface SearchTasksParams {
  query?: string;
  projectId?: string;
  areaId?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}
