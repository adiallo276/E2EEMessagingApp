import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Col, Row } from 'reactstrap';
import { TextFormat, Translate } from 'react-jhipster';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { APP_DATE_FORMAT } from 'app/config/constants';
import { useAppDispatch, useAppSelector } from 'app/config/store';

import { getEntity } from './message.reducer';

export const MessageDetail = () => {
  const dispatch = useAppDispatch();

  const { id } = useParams<'id'>();

  useEffect(() => {
    dispatch(getEntity(id));
  }, []);

  const messageEntity = useAppSelector(state => state.message.entity);
  return (
    <Row>
      <Col md="8">
        <h2 data-cy="messageDetailsHeading">
          <Translate contentKey="qMessagingApp.message.detail.title">Message</Translate>
        </h2>
        <dl className="jh-entity-details">
          <dt>
            <span id="id">
              <Translate contentKey="global.field.id">ID</Translate>
            </span>
          </dt>
          <dd>{messageEntity.id}</dd>
          <dt>
            <span id="content">
              <Translate contentKey="qMessagingApp.message.content">Content</Translate>
            </span>
          </dt>
          <dd>{messageEntity.content}</dd>
          <dt>
            <span id="ciphertext">
              <Translate contentKey="qMessagingApp.message.ciphertext">Ciphertext</Translate>
            </span>
          </dt>
          <dd>{messageEntity.ciphertext}</dd>
          <dt>
            <span id="timestamp">
              <Translate contentKey="qMessagingApp.message.timestamp">Timestamp</Translate>
            </span>
          </dt>
          <dd>{messageEntity.timestamp ? <TextFormat value={messageEntity.timestamp} type="date" format={APP_DATE_FORMAT} /> : null}</dd>
          <dt>
            <Translate contentKey="qMessagingApp.message.conversation">Conversation</Translate>
          </dt>
          <dd>{messageEntity.conversation ? messageEntity.conversation.id : ''}</dd>
          <dt>
            <Translate contentKey="qMessagingApp.message.sender">Sender</Translate>
          </dt>
          <dd>{messageEntity.sender ? messageEntity.sender.login : ''}</dd>
        </dl>
        <Button tag={Link} to="/message" replace color="info" data-cy="entityDetailsBackButton">
          <FontAwesomeIcon icon="arrow-left" />{' '}
          <span className="d-none d-md-inline">
            <Translate contentKey="entity.action.back">Back</Translate>
          </span>
        </Button>
        &nbsp;
        <Button tag={Link} to={`/message/${messageEntity.id}/edit`} replace color="primary">
          <FontAwesomeIcon icon="pencil-alt" />{' '}
          <span className="d-none d-md-inline">
            <Translate contentKey="entity.action.edit">Edit</Translate>
          </span>
        </Button>
      </Col>
    </Row>
  );
};

export default MessageDetail;
