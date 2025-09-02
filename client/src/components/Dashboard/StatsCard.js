import React from 'react';
import { Card } from 'react-bootstrap';
import { 
  FiShoppingBag, 
  FiCalendar, 
  FiDollarSign, 
  FiTrendingUp, 
  FiCheckCircle, 
  FiClock, 
  FiXCircle, 
  FiTarget,
  FiBarChart
} from 'react-icons/fi';

const iconMap = {
  'shopping-bag': FiShoppingBag,
  'calendar': FiCalendar,
  'dollar-sign': FiDollarSign,
  'trending-up': FiTrendingUp,
  'check-circle': FiCheckCircle,
  'clock': FiClock,
  'x-circle': FiXCircle,
  'target': FiTarget,
  'bar-chart': FiBarChart
};

const StatsCard = ({ title, value, icon, color = 'primary' }) => {
  const IconComponent = iconMap[icon] || FiBarChart;

  return (
    <Card className={`stats-card bg-${color} text-white h-100`}>
      <Card.Body className="d-flex align-items-center">
        <div className="flex-grow-1">
          <div className="h4 mb-0">{value}</div>
          <div className="small opacity-75">{title}</div>
        </div>
        <div className="ms-3">
          <IconComponent size={32} className="opacity-75" />
        </div>
      </Card.Body>
    </Card>
  );
};

export default StatsCard;
