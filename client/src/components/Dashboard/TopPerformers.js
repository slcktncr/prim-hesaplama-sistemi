import React, { useState } from 'react';
import { Card, ListGroup, Badge, Nav, Tab } from 'react-bootstrap';
import { formatCurrency, formatNumber } from '../../utils/helpers';
import { FiAward, FiUser, FiShoppingBag, FiDollarSign, FiTrendingUp } from 'react-icons/fi';

const TopPerformers = ({ performers }) => {
  const [activeTab, setActiveTab] = useState('salesCount');

  if (!performers || (!performers.salesCount?.length && !performers.salesAmount?.length && !performers.primAmount?.length)) {
    return (
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiAward className="me-2" />
            <h5 className="mb-0">En İyi Performans</h5>
          </div>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">Henüz performans verisi bulunmuyor.</p>
        </Card.Body>
      </Card>
    );
  }

  const getTabData = (tabKey) => {
    switch (tabKey) {
      case 'salesCount':
        return {
          data: performers.salesCount || [],
          title: 'Satış Adeti',
          icon: <FiShoppingBag className="me-2" />,
          primaryValue: (item) => `${formatNumber(item.count)} satış`,
          secondaryValue: (item) => formatCurrency(item.totalAmount),
          rightValue: (item) => formatCurrency(item.totalPrim)
        };
      case 'salesAmount':
        return {
          data: performers.salesAmount || [],
          title: 'Satış Tutarı',
          icon: <FiDollarSign className="me-2" />,
          primaryValue: (item) => formatCurrency(item.totalAmount),
          secondaryValue: (item) => `${formatNumber(item.count)} satış`,
          rightValue: (item) => formatCurrency(item.totalPrim)
        };
      case 'primAmount':
        return {
          data: performers.primAmount || [],
          title: 'Prim Tutarı',
          icon: <FiTrendingUp className="me-2" />,
          primaryValue: (item) => formatCurrency(item.totalPrim),
          secondaryValue: (item) => `${formatNumber(item.count)} satış • ${formatCurrency(item.totalAmount)}`,
          rightValue: (item) => formatCurrency(item.avgAmount || 0)
        };
      default:
        return { data: [], title: '', icon: null, primaryValue: () => '', secondaryValue: () => '', rightValue: () => '' };
    }
  };

  const currentTab = getTabData(activeTab);

  return (
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <FiAward className="me-2" />
            <h5 className="mb-0">En İyi Performans</h5>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <Nav variant="tabs" className="mt-3 top-performers-tabs" style={{ borderBottom: 'none' }}>
          <Nav.Item>
            <Nav.Link
              active={activeTab === 'salesCount'}
              onClick={() => setActiveTab('salesCount')}
              className="d-flex align-items-center px-3 py-2"
              style={{ 
                fontSize: '0.875rem',
                border: 'none',
                backgroundColor: activeTab === 'salesCount' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: activeTab === 'salesCount' ? '#0ea5e9' : '#6b7280',
                borderRadius: '6px'
              }}
            >
              <FiShoppingBag className="me-1" size={14} />
              Satış Adeti
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === 'salesAmount'}
              onClick={() => setActiveTab('salesAmount')}
              className="d-flex align-items-center px-3 py-2"
              style={{ 
                fontSize: '0.875rem',
                border: 'none',
                backgroundColor: activeTab === 'salesAmount' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: activeTab === 'salesAmount' ? '#0ea5e9' : '#6b7280',
                borderRadius: '6px'
              }}
            >
              <FiDollarSign className="me-1" size={14} />
              Satış Tutarı
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === 'primAmount'}
              onClick={() => setActiveTab('primAmount')}
              className="d-flex align-items-center px-3 py-2"
              style={{ 
                fontSize: '0.875rem',
                border: 'none',
                backgroundColor: activeTab === 'primAmount' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: activeTab === 'primAmount' ? '#0ea5e9' : '#6b7280',
                borderRadius: '6px'
              }}
            >
              <FiTrendingUp className="me-1" size={14} />
              Prim Tutarı
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </Card.Header>
      
      <Card.Body className="p-0">
        <ListGroup variant="flush">
          {currentTab.data.length > 0 ? (
            currentTab.data.map((performer, index) => (
              <ListGroup.Item key={performer._id} className="d-flex align-items-center">
                <div className="me-3">
                  <Badge 
                    bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : index === 2 ? 'success' : 'light'}
                    text={index > 2 ? 'dark' : 'white'}
                    className="rounded-circle d-flex align-items-center justify-content-center performance-badge"
                  >
                    {index + 1}
                  </Badge>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center mb-1">
                    <FiUser className="me-2 text-muted" size={16} />
                    <strong>{performer.name}</strong>
                  </div>
                  <div className="small text-primary fw-bold">
                    {currentTab.primaryValue(performer)}
                  </div>
                  <div className="small text-muted">
                    {currentTab.secondaryValue(performer)}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-success fw-bold">
                    {currentTab.rightValue(performer)}
                  </div>
                  <div className="small text-muted">
                    {activeTab === 'primAmount' ? 'Ort. Satış' : 'Prim'}
                  </div>
                </div>
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item className="text-center text-muted py-4">
              <div>{currentTab.icon}</div>
              <div>Bu kategoride veri bulunmuyor</div>
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

export default TopPerformers;
