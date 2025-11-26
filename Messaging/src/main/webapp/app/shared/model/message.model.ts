import dayjs from 'dayjs';
import { IConversation } from 'app/shared/model/conversation.model';
import { IUser } from 'app/shared/model/user.model';

export interface IMessage {
  id?: number;
  content?: string;
  ciphertext?: string | null;
  timestamp?: dayjs.Dayjs;
  conversation?: IConversation | null;
  sender?: IUser | null;
}

export const defaultValue: Readonly<IMessage> = {};
