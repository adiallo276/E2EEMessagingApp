import dayjs from 'dayjs';
import { IUser } from 'app/shared/model/user.model';

export interface IConversation {
  id?: number;
  createdAt?: dayjs.Dayjs;
  user1?: IUser | null;
  user2?: IUser | null;
}

export const defaultValue: Readonly<IConversation> = {};
