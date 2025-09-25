import React from 'react';
import { Modal, Table, Badge, Alert, Row, Col, Card } from 'react-bootstrap';
import { FiClock, FiUser, FiEdit, FiTrendingUp, FiTrendingDown, FiMapPin, FiCalendar, FiDollarSign } from 'react-icons/fi';

import { formatCurrency, formatDate } from '../../utils/helpers';

const ModificationHistoryModal = ({ show, onHide, sale }) => {
  if (!sale || !sale.modificationHistory || sale.modificationHistory.length === 0) {
    return (
      <Modal show={show} onHide={onHide} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiClock className="me-2" />
            Değişiklik Geçmişi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            Bu satış için henüz değişiklik kaydı bulunmuyor.
          </Alert>
        </Modal.Body>
      </Modal>
    );
  }

  const renderComparisonRow = (label, previousValue, newValue, isDate = false, isCurrency = false) => {
    const formatValue = (value) => {
      if (!value && value !== 0) return '-';
      if (isDate) return formatDate(value);
      if (isCurrency) return formatCurrency(value);
      return value.toString();
    };

    const hasChanged = previousValue !== newValue;

    return (
      <tr key={label}>
        <td className="fw-bold">{label}</td>
        <td className={hasChanged ? 'text-muted' : ''}>{formatValue(previousValue)}</td>
        <td className={hasChanged ? 'text-primary fw-bold' : ''}>{formatValue(newValue)}</td>
        <td className="text-center">
          {hasChanged ? (
            <Badge bg="warning">Değişti</Badge>
          ) : (
            <Badge bg="light" text="dark">Aynı</Badge>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          <FiClock className="me-2" />
          Değişiklik Geçmişi
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="mb-4">
          <strong>Satış:</strong> {sale.customerName} - {sale.blockNo}/{sale.apartmentNo} - Dönem: {sale.periodNo}
        </Alert>

        {sale.modificationHistory.map((modification, index) => (
          <Card key={index} className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  <FiEdit className="me-2" />
                  Değişiklik #{sale.modificationHistory.length - index}
                </h6>
                <div className="text-muted small">
                  <FiUser className="me-1" />
                  {modification.modifiedBy?.name || modification.modifiedBy || 'Sistem'} - {formatDate(modification.modifiedAt)}
                </div>
              </div>
            </Card.Header>
            
            <Card.Body>
              {/* Değişiklik Özeti */}
              {modification.changesSummary && (
                <Row className="mb-3">
                  <Col>
                    <Alert variant="info">
                      <strong>Değişiklik Özeti:</strong>
                      <div className="mt-2">
                        {modification.changesSummary.locationChange && (
                          <div>
                            <FiMapPin className="me-1" />
                            <strong>Konum:</strong> {modification.changesSummary.locationChange}
                          </div>
                        )}
                        {modification.changesSummary.periodChange && (
                          <div>
                            <FiCalendar className="me-1" />
                            <strong>Dönem:</strong> {modification.changesSummary.periodChange}
                          </div>
                        )}
                        {modification.changesSummary.priceChange && (
                          <div>
                            <FiDollarSign className="me-1" />
                            <strong>Liste Fiyatı:</strong> {modification.changesSummary.priceChange}
                          </div>
                        )}
                        {modification.changesSummary.activityPriceChange && (
                          <div>
                            <FiDollarSign className="me-1" />
                            <strong>Aktivite Fiyatı:</strong> {modification.changesSummary.activityPriceChange}
                          </div>
                        )}
                      </div>
                    </Alert>
                  </Col>
                </Row>
              )}

              {/* Prim Farkı */}
              {modification.primDifference && modification.primDifference !== 0 && (
                <Row className="mb-3">
                  <Col>
                    <Alert variant={modification.primDifference > 0 ? "success" : "warning"}>
                      <div className="d-flex align-items-center">
                        {modification.primDifference > 0 ? (
                          <FiTrendingUp className="me-2" size={20} />
                        ) : (
                          <FiTrendingDown className="me-2" size={20} />
                        )}
                        <div>
                          <strong>Prim Farkı:</strong> {modification.primDifference > 0 ? '+' : ''}{formatCurrency(modification.primDifference)}
                          <div className="small">
                            Eski Prim: {formatCurrency(modification.oldPrimAmount)} → 
                            Yeni Prim: {formatCurrency(modification.newPrimAmount)}
                          </div>
                        </div>
                      </div>
                    </Alert>
                  </Col>
                </Row>
              )}

              {modification.reason && (
                <Alert variant="secondary" className="mb-3">
                  <strong>Sebep:</strong> {modification.reason}
                </Alert>
              )}

              {/* Detaylı Karşılaştırma Tablosu */}
              <Row>
                <Col>
                  <h6 className="mb-3">Detaylı Değişiklikler</h6>
                  <Table striped bordered hover size="sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Alan</th>
                        <th>Önceki Değer</th>
                        <th>Yeni Değer</th>
                        <th className="text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderComparisonRow('Blok No', modification.previousData?.blockNo, modification.newData?.blockNo)}
                      {renderComparisonRow('Daire No', modification.previousData?.apartmentNo, modification.newData?.apartmentNo)}
                      {renderComparisonRow('Dönem No', modification.previousData?.periodNo, modification.newData?.periodNo)}
                      {renderComparisonRow('Liste Fiyatı', modification.previousData?.listPrice, modification.newData?.listPrice, false, true)}
                      {renderComparisonRow('İndirim Oranı (%)', modification.previousData?.discountRate, modification.newData?.discountRate)}
                      {renderComparisonRow('Aktivite Satış Fiyatı', modification.previousData?.activitySalePrice, modification.newData?.activitySalePrice, false, true)}
                      {renderComparisonRow('Sözleşme No', modification.previousData?.contractNo, modification.newData?.contractNo)}
                      {modification.previousData?.saleDate && renderComparisonRow('Satış Tarihi', modification.previousData?.saleDate, modification.newData?.saleDate, true)}
                      {modification.previousData?.kaporaDate && renderComparisonRow('Kapora Tarihi', modification.previousData?.kaporaDate, modification.newData?.kaporaDate, true)}
                      {renderComparisonRow('Giriş Tarihi', modification.previousData?.entryDate, modification.newData?.entryDate)}
                      {renderComparisonRow('Çıkış Tarihi', modification.previousData?.exitDate, modification.newData?.exitDate)}
                      {renderComparisonRow('Base Prim Fiyatı', modification.previousData?.basePrimPrice, modification.newData?.basePrimPrice, false, true)}
                      {renderComparisonRow('Prim Tutarı', modification.previousData?.primAmount, modification.newData?.primAmount, false, true)}
                    </tbody>
                  </Table>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}
      </Modal.Body>
    </Modal>
  );
};

export default ModificationHistoryModal;
