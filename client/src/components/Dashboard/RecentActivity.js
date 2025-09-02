import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { primsAPI } from '../../utils/api';
import { formatCurrency, formatRelativeTime, getTransactionTypeBadgeClass, getTransactionTypeText } from '../../utils/helpers';
import { FiActivity } from 'react-icons/fi';
import Loading from '../Common/Loading';

const RecentActivity = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentTransactions();
  }, []);

  const fetchRecentTransactions = async () => {
    try {
      setLoading(true);
      const response = await primsAPI.getTransactions({ page: 1, limit: 5 });
      setTransactions(response.data.transactions || []);
      setError(null);
    } catch (error) {
      console.error('Recent transactions fetch error:', error);
      setError('Son aktiviteler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiActivity className="me-2" />
            <h5 className="mb-0">Son Aktiviteler</h5>
          </div>
        </Card.Header>
        <Card.Body>
          <Loading size="sm" text="" />
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiActivity className="me-2" />
            <h5 className="mb-0">Son Aktiviteler</h5>
          </div>
        </Card.Header>
        <Card.Body>
          <Alert variant="danger" className="mb-0">
            {error}
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiActivity className="me-2" />
            <h5 className="mb-0">Son Aktiviteler</h5>
          </div>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-0">Henüz aktivite bulunmuyor.</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <FiActivity className="me-2" />
            <h5 className="mb-0">Son Aktiviteler</h5>
          </div>
          <a href="/prims/transactions" className="btn btn-sm btn-outline-primary">
            Tümünü Gör
          </a>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <ListGroup variant="flush">
          {transactions.map((transaction) => (
            <ListGroup.Item key={transaction._id} className="d-flex align-items-center">
              <div className="flex-grow-1">
                <div className="d-flex align-items-center mb-1">
                  <Badge 
                    bg={getTransactionTypeBadgeClass(transaction.transactionType)}
                    className="me-2"
                  >
                    {getTransactionTypeText(transaction.transactionType)}
                  </Badge>
                  <small className="text-muted">
                    {transaction.salesperson?.name}
                  </small>
                </div>
                <div className="small text-muted">
                  {transaction.description}
                </div>
                <div className="small text-muted">
                  {formatRelativeTime(transaction.createdAt)}
                </div>
              </div>
              <div className="text-end">
                <div className={`fw-bold ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                  {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

export default RecentActivity;
