import React from 'react';
import { Route } from 'react-router-dom';

import ErrorBoundaryRoutes from 'app/shared/error/error-boundary-routes';

import Conversation from './conversation';
import ConversationDetail from './conversation-detail';
import ConversationUpdate from './conversation-update';
import ConversationDeleteDialog from './conversation-delete-dialog';

const ConversationRoutes = () => (
  <ErrorBoundaryRoutes>
    <Route index element={<Conversation />} />
    <Route path="new" element={<ConversationUpdate />} />
    <Route path=":id">
      <Route index element={<ConversationDetail />} />
      <Route path="edit" element={<ConversationUpdate />} />
      <Route path="delete" element={<ConversationDeleteDialog />} />
    </Route>
  </ErrorBoundaryRoutes>
);

export default ConversationRoutes;
