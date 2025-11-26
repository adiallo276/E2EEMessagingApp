import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Col, Row } from 'reactstrap';
import { TextFormat, Translate } from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './conversation.reducer';

export const ConversationDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id));
  }, []);

  const conversationEntity = useAppSelector(state => state.conversation.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="conversationDetailsHeading">
          <Translate contentKey="messageApp.conversation.detail.title">Conversation</Translate>
        </h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">
              <Translate contentKey="global.field.id">ID</Translate>
            </span>
          </dt>
          <dd>{conversationEntity.id}</dd>
          <dt>
            <span id="createdAt">
              <Translate contentKey="messageApp.conversation.createdAt">Created At</Translate>
            </span>
          </dt>
          <dd>
            {conversationEntity.createdAt ? <TextFormat value={conversationEntity.createdAt} type="date" format={APP_DATE_FORMAT} /> : null}
          </dd>
          <dt>
            <Translate contentKey="messageApp.conversation.user1">User 1</Translate>
          </dt>
          <dd>{conversationEntity.user1 ? conversationEntity.user1.login : ''}</dd>
          <dt>
            <Translate contentKey="messageApp.conversation.user2">User 2</Translate>
          </dt>
          <dd>{conversationEntity.user2 ? conversationEntity.user2.login : ''}</dd>
        </dl>
        <Button tag={Link} to="/conversation" replace color="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" />{' '}
          <span className="d-none d-md-inline">
            <Translate contentKey="entity.action.back">Back</Translate>
          </span>
        </Button>
        &nbsp;
        <Button tag={Link} to={`/conversation/${conversationEntity.id}/edit`} replace color="primary">
          <FontAwesomeIcon icon="pencil-alt" />{' '}
          <span className="d-none d-md-inline">
            <Translate contentKey="entity.action.edit">Edit</Translate>
          </span>
        </Button>
      </Col>
    </Row>
  );
};

export default ConversationDetail;
