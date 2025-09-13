import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Form, 
  InputGroup, 
  Badge, 
  Alert,
  Pagination,
  Button,
  Modal
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiSearch, 
  FiRefreshCw, 
  FiFilter,
  FiUser,
  FiCalendar
} from 'react-icons/fi';

import { primsAPI, salesAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCurrency, 
  formatDateTime,
  getTransactionTypeBadgeClass,
  getTransactionTypeText,
  debounce 
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const PrimTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalDeductions, setTotalDeductions] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [netTotal, setNetTotal] = useState(0);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 15,
    period: '',
    type: ''
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0
  });

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Dönem değiştirme modal state'leri
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    const debouncedFetch = debounce(() => {
      fetchTransactions();
      fetchTotals();
    }, 300);
    debouncedFetch();
  }, [filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await primsAPI.getTransactions(filters);
      setTransactions(response.data.transactions || []);
      setPagination({
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
        total: response.data.total || 0
      });
      setError(null);
    } catch (error) {
      console.error('Transactions fetch error:', error);
      setError('Prim işlemleri yüklenirken hata oluştu');
      toast.error('Prim işlemleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
    }
  };

  const fetchTotals = async () => {
    try {
      // Tüm işlemler için ayrı API çağrısı - sayfalama olmadan
      const totalFilters = {
        period: filters.period, // Sadece dönem filtresini koru
        limit: 10000 // Çok yüksek limit ile tüm kayıtları al
      };
      const response = await primsAPI.getTransactions(totalFilters);
      const allTransactions = response.data.transactions || [];
      
      // Toplam kazanç (pozitif tutarlar)
      const earnings = allTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Toplam kesinti (sadece kesinti tipindeki işlemler)
      const deductions = Math.abs(
        allTransactions
          .filter(t => t.transactionType === 'kesinti')
          .reduce((sum, t) => sum + t.amount, 0)
      );
      
      // Net tutar (tüm işlemlerin toplamı)
      const net = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      setTotalEarnings(earnings);
      setTotalDeductions(deductions);
      setNetTotal(net);
    } catch (error) {
      console.error('Total calculations fetch error:', error);
      setTotalEarnings(0);
      setTotalDeductions(0);
      setNetTotal(0);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({
      ...prev,
      page
    }));
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'kazanç':
        return '↗️';
      case 'kesinti':
        return '↘️';
      case 'transfer_gelen':
        return '⬅️';
      case 'transfer_giden':
        return '➡️';
      default:
        return '💰';
    }
  };

  // Dönem değiştirme fonksiyonları
  const handleChangePeriod = (transaction) => {
    setSelectedTransaction(transaction);
    setSelectedPeriod(transaction.primPeriod?._id || '');
    setShowPeriodModal(true);
  };

  const handlePeriodUpdate = async () => {
    if (!selectedTransaction || !selectedPeriod) {
      toast.error('Lütfen dönem seçiniz');
      return;
    }

    if (selectedPeriod === selectedTransaction.primPeriod?._id) {
      toast.info('Aynı dönem seçildi, değişiklik yapılmadı');
      setShowPeriodModal(false);
      return;
    }

    try {
      setModalLoading(true);
      await salesAPI.updateTransactionPeriod(selectedTransaction._id, selectedPeriod);
      
      toast.success('Transaction dönemi başarıyla değiştirildi');
      setShowPeriodModal(false);
      fetchTransactions(); // Listeyi yenile
    } catch (error) {
      console.error('Period update error:', error);
      const message = error.response?.data?.message || 'Dönem değiştirme işleminde hata oluştu';
      toast.error(message);
    } finally {
      setModalLoading(false);
    }
  };

  const closePeriodModal = () => {
    setShowPeriodModal(false);
    setSelectedTransaction(null);
    setSelectedPeriod('');
  };

  if (loading && transactions.length === 0) {
    return <Loading variant="dots" size="large" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Prim İşlemleri</h1>
          <p className="text-muted mb-0">
            Toplam {pagination.total} işlem
            {!isAdmin && ` (${user?.name})`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Dönem</Form.Label>
                <Form.Select
                  value={filters.period}
                  onChange={(e) => handleFilterChange('period', e.target.value)}
                >
                  <option value="">Tüm Dönemler</option>
                  {periods.map(period => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>İşlem Tipi</Form.Label>
                <Form.Select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <option value="">Tüm İşlemler</option>
                  <option value="kazanç">Kazanç</option>
                  <option value="kesinti">Kesinti</option>
                  <option value="transfer_gelen">Transfer (Gelen)</option>
                  <option value="transfer_giden">Transfer (Giden)</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={fetchTransactions} disabled={loading}>
                    <FiRefreshCw className={loading ? 'spin' : ''} />
                  </Button>
                  <Button 
                    variant="outline-primary" 
                    onClick={() => setFilters({ page: 1, limit: 15, period: '', type: '' })}
                  >
                    <FiFilter className="me-2" />
                    Temizle
                  </Button>
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-success mb-1">
                {formatCurrency(totalEarnings)}
              </div>
              <div className="text-muted small">Toplam Kazanç</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-danger mb-1">
                {formatCurrency(totalDeductions)}
              </div>
              <div className="text-muted small">Toplam Kesinti</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-primary mb-1">
                {formatCurrency(netTotal)}
              </div>
              <div className="text-muted small">Net Tutar</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-info mb-1">
                {transactions.length}
              </div>
              <div className="text-muted small">Toplam İşlem</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Transactions Table */}
      <Card>
        <Card.Body className="p-0">
          {transactions.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">Henüz prim işlemi bulunamadı.</p>
            </div>
          ) : (
            <>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem</th>
                    <th>Açıklama</th>
                    <th>Satış</th>
                    <th>Dönem</th>
                    <th>Temsilci</th>
                    <th>Tutar</th>
                    {isAdmin && <th>İşlemler</th>}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id}>
                      <td>
                        <div className="small">
                          {formatDateTime(transaction.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="me-2" style={{ fontSize: '1.2em' }}>
                            {getTransactionIcon(transaction.transactionType)}
                          </span>
                          <Badge bg={getTransactionTypeBadgeClass(transaction.transactionType)}>
                            {getTransactionTypeText(transaction.transactionType)}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <div className="text-wrap" style={{ maxWidth: '300px' }}>
                          {transaction.description}
                        </div>
                      </td>
                      <td>
                        {transaction.sale ? (
                          <div>
                            <code className="small">{transaction.sale.contractNo}</code>
                            <div className="small text-muted">
                              {transaction.sale.customerName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FiCalendar className="me-2 text-muted" size={14} />
                          <small>{transaction.primPeriod?.name || '-'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FiUser className="me-2 text-muted" size={14} />
                          <small>{transaction.salesperson?.name}</small>
                        </div>
                      </td>
                      <td>
                        <div className={`fw-bold ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleChangePeriod(transaction)}
                            title="Dönem Değiştir"
                          >
                            📅
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="d-flex justify-content-center p-3">
                  <Pagination>
                    <Pagination.First 
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.currentPage === 1}
                    />
                    <Pagination.Prev 
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                    />
                    
                    {[...Array(pagination.totalPages)].map((_, index) => {
                      const page = index + 1;
                      if (
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
                      ) {
                        return (
                          <Pagination.Item
                            key={page}
                            active={page === pagination.currentPage}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </Pagination.Item>
                        );
                      } else if (
                        page === pagination.currentPage - 3 ||
                        page === pagination.currentPage + 3
                      ) {
                        return <Pagination.Ellipsis key={page} />;
                      }
                      return null;
                    })}
                    
                    <Pagination.Next 
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                    />
                    <Pagination.Last 
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.currentPage === pagination.totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Dönem Değiştirme Modal */}
      <Modal show={showPeriodModal} onHide={closePeriodModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Dönem Değiştir</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransaction && (
            <div>
              <div className="mb-3">
                <strong>İşlem:</strong> {selectedTransaction.description}
              </div>
              <div className="mb-3">
                <strong>Tutar:</strong> {' '}
                <span className={selectedTransaction.amount >= 0 ? 'text-success' : 'text-danger'}>
                  {selectedTransaction.amount >= 0 ? '+' : ''}{formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
              <div className="mb-3">
                <strong>Mevcut Dönem:</strong> {selectedTransaction.primPeriod?.name || 'Bilinmeyen'}
              </div>
              
              <Form.Group>
                <Form.Label>Yeni Dönem</Form.Label>
                <Form.Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">Dönem seçiniz...</option>
                  {periods.map(period => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePeriodModal} disabled={modalLoading}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handlePeriodUpdate} 
            disabled={modalLoading || !selectedPeriod}
          >
            {modalLoading ? 'Güncelleniyor...' : 'Dönem Değiştir'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PrimTransactions;
