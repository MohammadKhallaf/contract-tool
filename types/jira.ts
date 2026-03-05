export interface AcceptanceCriteria {
  id: string;
  text: string;
  checked: boolean;
}

export interface JiraStory {
  key?: string;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriteria[];
  storyPoints?: number;
  labels: string[];
  priority?: string;
  rawText?: string;
}
