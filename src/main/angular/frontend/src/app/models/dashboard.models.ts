export interface Announcement {
  id: number;
  pinned: boolean;
  tag: string;
  tagColor: string;
  title: string;
  text: string;
  meta: string;
  time: string;
}

export interface Notification {
  id: number;
  type: 'mention' | 'activity';
  unread: boolean;
  avatar: string;
  color: string;
  name: string;
  text: string;
  project: string;
  time: string;
}

export interface ActiveProject {
  id: number;
  name: string;
  progress: number;
  color: string;
}

export interface PortfolioProject {
  name: string;
  status: 'On Track' | 'At Risk' | 'Delayed';
  progress: number;
  owner: string;
  ownerInitial: string;
  ownerColor: string;
  dueDate: string;
  health: number;
}

export interface TeamMember {
  initial: string;
  name: string;
  role: string;
  tasks: number;
  color: string;
  online: boolean;
}

export interface MyTask {
  title: string;
  project: string;
  priority: 'red' | 'yellow' | 'blue' | 'green' | 'purple' | 'cyan' | 'orange';
  due: string;
  status: string;
  statusColor: string;
  done?: boolean;
}

export interface OverdueTask {
  title: string;
  project: string;
  daysOverdue: number;
  priority: 'red' | 'amber';
}

export interface Activity {
  user: string;
  initial: string;
  color: string;
  action: string;
  time: string;
}

export interface Deadline {
  project: string;
  task: string;
  date: string;
  status: 'urgent' | 'soon' | 'normal';
}