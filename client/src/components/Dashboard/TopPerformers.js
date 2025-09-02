import React from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import { formatCurrency, formatNumber } from '../../utils/helpers';
import { FiTrophy, FiUser } from 'react-icons/fi';

const TopPerformers = ({ performers }) => {
  if (!performers || performers.length === 0) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiTrophy className="me-2" />
            <h5 className="mb-0">En İyi Performans</h5>
          </div>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">Henüz performans verisi bulunmuyor.</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center">
          <FiTrophy className="me-2" />
          <h5 className="mb-0">En İyi Performans</h5>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <ListGroup variant="flush">
          {performers.map((performer, index) => (
            <ListGroup.Item key={performer._id} className="d-flex align-items-center">
              <div className="me-3">
                <Badge 
                  bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : 'light'}
                  text={index === 2 ? 'dark' : 'white'}
                  className="rounded-circle p-2"
                >
                  {index + 1}
                </Badge>
              </div>
              <div className="flex-grow-1">
                <div className="d-flex align-items-center mb-1">
                  <FiUser className="me-2 text-muted" size={16} />
                  <strong>{performer.name}</strong>
                </div>
                <div className="small text-muted">
                  {formatNumber(performer.count)} satış • {formatCurrency(performer.totalAmount)}
                </div>
              </div>
              <div className="text-end">
                <div className="text-success font-weight-bold">
                  {formatCurrency(performer.totalPrim)}
                </div>
                <div className="small text-muted">Prim</div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

export default TopPerformers;
