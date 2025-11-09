
export type Role = 'user' | 'model';

export interface ExampleChoice {
  source: string;
  summary: string;
}

export interface Message {
  role: Role;
  content: string;
  isError?: boolean;
  choices?: ExampleChoice[];
  feedback?: 'positive' | 'negative';
  suggestions?: string[];
}
