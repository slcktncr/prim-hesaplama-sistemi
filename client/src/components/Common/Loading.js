import React from 'react';
import { Spinner } from 'react-bootstrap';

const Loading = ({ size = 'lg', text = 'Yükleniyor...' }) => {
  return (
    <div className="loading-spinner">
      <div className="text-center">
        <Spinner animation="border" variant="primary" size={size} />
        {text && <div className="mt-3">{text}</div>}
      </div>
    </div>
  );
};

export default Loading;
