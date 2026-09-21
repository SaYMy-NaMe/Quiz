export interface Instructor {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends Credentials {
  name: string;
}
