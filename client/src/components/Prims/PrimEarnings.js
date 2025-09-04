import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Form, 
  Badge, 
  Alert,
  Button,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiRefreshCw, 
  FiFilter,
  FiUser,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign
} from 'react-icons/fi';

import { primsAPI, usersAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  formatCurrency, 
  formatNumber,
  debounce 
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const PrimEarnings = () => {
  const [earnings, setEarnings] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    period: '',
    salesperson: ''
  });

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchPeriods();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    const debouncedFetch = debounce(fetchEarnings, 300);
    debouncedFetch();
  }, [filters]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      
      // Hem earnings hem de deductions getir
      const [earningsResponse, deductionsResponse] = await Promise.all([
        primsAPI.getEarnings(filters),
        primsAPI.getDeductions(filters)
      ]);
      
      setEarnings(earningsResponse.data || []);
      setDeductions(deductionsResponse.data || []);
      setError(null);
    } catch (error) {
      console.error('Earnings fetch error:', error);
      setError('Prim hakedişleri yüklenirken hata oluştu');
      toast.error('Prim hakedişleri yüklenirken hata oluştu');
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

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalEarnings = () => {
    return earnings.reduce((sum, earning) => sum + earning.totalEarnings, 0);
  };

  const calculateTotalTransactions = () => {
    return earnings.reduce((sum, earning) => sum + earning.transactionCount, 0);
  };

  const getEarningsBadgeVariant = (amount) => {
    if (amount > 0) return 'success';
    if (amount < 0) return 'danger';
    return 'secondary';
  };

  const getProgressPercentage = (current, max) => {
    if (max === 0) return 0;
    return Math.min((Math.abs(current) / max) * 100, 100);
  };

  const maxEarning = Math.max(...earnings.map(e => Math.abs(e.totalEarnings)), 1);

  if (loading && earnings.length === 0) {
    return <Loading text="Prim hakedişleri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Prim Hakedişleri</h1>
          <p className="text-muted mb-0">
            Temsilci bazında prim hakediş özeti
            {!isAdmin && ` (${user?.name})`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={isAdmin ? 4 : 6}>
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
            {isAdmin && (
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Temsilci</Form.Label>
                  <Form.Select
                    value={filters.salesperson}
                    onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                  >
                    <option value="">Tüm Temsilciler</option>
                    {users.map(user => (
                      <option key={user._id} value={user._id}>
                        {user.name} {user.role === 'admin' && '(Admin)'}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            )}
            <Col md={isAdmin ? 4 : 6}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={fetchEarnings} disabled={loading}>
                    <FiRefreshCw className={loading ? 'spin' : ''} />
                  </Button>
                  <Button 
                    variant="outline-primary" 
                    onClick={() => setFilters({ period: '', salesperson: '' })}
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
      {earnings.length > 0 && (
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <div className="h4 text-primary mb-1">
                  {formatCurrency(calculateTotalEarnings())}
                </div>
                <div className="text-muted small">Toplam Hakediş</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <div className="h4 text-info mb-1">
                  {formatNumber(calculateTotalTransactions())}
                </div>
                <div className="text-muted small">Toplam İşlem</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <div className="h4 text-success mb-1">
                  {earnings.filter(e => e.totalEarnings > 0).length}
                </div>
                <div className="text-muted small">Pozitif Hakediş</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <div className="h4 text-warning mb-1">
                  {earnings.length}
                </div>
                <div className="text-muted small">Toplam Kayıt</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Earnings Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Hakediş Detayları</h5>
            {earnings.length > 0 && (
              <Badge bg="primary">{earnings.length} kayıt</Badge>
            )}
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {earnings.length === 0 ? (
            <div className="text-center py-5">
              <FiDollarSign size={48} className="text-muted mb-3" />
              <p className="text-muted">Henüz prim hakediş kaydı bulunamadı.</p>
              <p className="text-muted small">
                Satış yaptıktan sonra prim hakedişleriniz burada görünecektir.
              </p>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Temsilci</th>
                  <th>Dönem</th>
                  <th>Satış Bilgileri</th>
                  <th>Ödeme Durumu</th>
                  <th>Toplam Prim</th>
                  <th>İşlem Detayları</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((earning, index) => (
                  <tr key={`${earning._id.salesperson}-${earning._id.primPeriod}`}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="me-3">
                          <div 
                            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            {earning.salesperson?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <div>
                          <div className="fw-bold">{earning.salesperson?.name || 'Bilinmeyen'}</div>
                          <div className="small text-muted">
                            <FiUser className="me-1" size={12} />
                            Temsilci
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <FiCalendar className="me-2 text-muted" size={16} />
                        <div>
                          <div className="fw-bold">{earning.primPeriod?.name || 'Bilinmeyen'}</div>
                          <div className="small text-muted">Dönem</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-center">
                        <div className="h5 mb-1 text-info">
                          {earning.salesCount || 0}
                        </div>
                        <div className="small text-muted">Satış Adedi</div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-success">
                            Ödenen:
                          </span>
                          <span className="fw-bold text-success">
                            {formatCurrency(earning.paidAmount || 0)}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-warning">
                            Ödenmemiş:
                          </span>
                          <span className="fw-bold text-warning">
                            {formatCurrency(earning.unpaidAmount || 0)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="h5 mb-1 text-primary">
                          {formatCurrency((earning.paidAmount || 0) + (earning.unpaidAmount || 0))}
                        </div>
                        <div className="small text-muted">
                          Toplam Prim Hakediş
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-success">
                            <FiTrendingUp className="me-1" size={12} />
                            Kazanç: {earning.kazancCount}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-danger">
                            <FiTrendingDown className="me-1" size={12} />
                            Kesinti: {earning.kesintiCount}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-info">
                            ↔️ Transfer: {earning.transferGelenCount + earning.transferGidenCount}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <strong>Toplam: {earning.transactionCount}</strong>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Deductions Table */}
      {deductions.length > 0 && (
        <Card className="mt-4">
          <Card.Header className="bg-danger text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📉 Kesinti Dönemleri</h5>
              <Badge bg="light" text="dark">{deductions.length} kesinti</Badge>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Temsilci</th>
                  <th>Dönem</th>
                  <th>Kesinti Tutarı</th>
                  <th>İşlem Detayları</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((deduction, index) => (
                  <tr key={`${deduction._id.salesperson}-${deduction._id.primPeriod}`}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="me-3">
                          <div 
                            className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            {deduction.salesperson?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        </div>
                        <div>
                          <div className="fw-bold">{deduction.salesperson?.name || 'Bilinmeyen'}</div>
                          <div className="small text-muted">
                            <FiUser className="me-1" size={12} />
                            Temsilci
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <FiCalendar className="me-2 text-muted" size={16} />
                        <div>
                          <div className="fw-bold">{deduction.primPeriod?.name || 'Bilinmeyen'}</div>
                          <div className="small text-muted">Kesinti Dönemi</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-center">
                        <div className="h5 mb-1 text-danger">
                          {formatCurrency(deduction.totalDeductions)}
                        </div>
                        <div className="small text-muted">Toplam Kesinti</div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <Badge variant="danger" className="me-2">
                          {deduction.transactionCount} İşlem
                        </Badge>
                        <div className="mt-1">
                          <small className="text-muted">
                            Bu dönemde satış yok, sadece kesinti var
                          </small>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Additional Info */}
      {earnings.length > 0 && (
        <Card className="mt-4">
          <Card.Body>
            <Row>
              <Col md={6}>
                <h6>Özet Bilgiler</h6>
                <ul className="list-unstyled small">
                  <li>• Pozitif hakediş: {earnings.filter(e => e.totalEarnings > 0).length} temsilci</li>
                  <li>• Negatif hakediş: {earnings.filter(e => e.totalEarnings < 0).length} temsilci</li>
                  <li>• Sıfır hakediş: {earnings.filter(e => e.totalEarnings === 0).length} temsilci</li>
                </ul>
              </Col>
              <Col md={6}>
                <h6>Açıklamalar</h6>
                <ul className="list-unstyled small">
                  <li>• <span className="text-success">Kazanç:</span> Satış primlerinden gelen gelir</li>
                  <li>• <span className="text-danger">Kesinti:</span> İptal edilen ödenmiş primlerden kesinti</li>
                  <li>• <span className="text-info">Transfer:</span> Temsilciler arası satış transferleri</li>
                </ul>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default PrimEarnings;
