import { Comment } from './Comment';

export type Issue = {
  id: string;
  url: string;
  title: string;
  labels: string[];
  status: string;
  comments: Comment[];
};
