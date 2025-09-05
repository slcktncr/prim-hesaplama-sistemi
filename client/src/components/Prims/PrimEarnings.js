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
  ProgressBar,
  Modal
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiRefreshCw, 
  FiFilter,
  FiUser,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiClock
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
  console.log('🚀 PrimEarnings component mounting...');
  
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

  // Kesinti modal state'leri
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [selectedDeductions, setSelectedDeductions] = useState(null);

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
    return (earnings || []).reduce((sum, earning) => sum + (earning?.totalEarnings || 0), 0);
  };

  const calculateTotalTransactions = () => {
    return (earnings || []).reduce((sum, earning) => sum + (earning?.transactionCount || 0), 0);
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

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('Yinelenen kesinti transaction\'larını temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await primsAPI.cleanupDuplicateDeductions();
      
      toast.success(`${response.data.cleanedCount} yinelenen kesinti temizlendi. Toplam: ${response.data.totalAmount.toLocaleString('tr-TR')} TL`);
      
      // Listeyi yenile
      fetchEarnings();
    } catch (error) {
      console.error('Cleanup error:', error);
      const message = error.response?.data?.message || 'Temizleme işleminde hata oluştu';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Modal açma fonksiyonu (dönem ataması gibi)
  const showDeductionDetails = (earning) => {
    console.log('🔍 Opening deduction modal for:', earning.salesperson?.name);
    setSelectedDeductions(earning);
    setShowDeductionModal(true);
  };

  const closeDeductionModal = () => {
    setShowDeductionModal(false);
    setSelectedDeductions(null);
  };

  const handleApproveDeduction = async (deductionId) => {
    try {
      await primsAPI.approveDeduction(deductionId);
      toast.success('Kesinti onaylandı ve hakediş\'ten düşüldü');
      fetchEarnings(); // Verileri yenile
      closeDeductionModal();
    } catch (error) {
      console.error('Approve deduction error:', error);
      toast.error(error.response?.data?.message || 'Kesinti onaylama hatası');
    }
  };

  const handleCancelDeduction = async (deductionId) => {
    try {
      await primsAPI.cancelDeduction(deductionId);
      toast.success('Kesinti iptal edildi');
      fetchEarnings(); // Verileri yenile
      closeDeductionModal();
    } catch (error) {
      console.error('Cancel deduction error:', error);
      toast.error(error.response?.data?.message || 'Kesinti iptal hatası');
    }
  };


  const maxEarning = Math.max(...(earnings || []).map(e => Math.abs(e?.totalEarnings || 0)), 1);

  console.log('🔍 PrimEarnings render state:', { loading, earningsCount: earnings.length, error });
  
  if (loading && earnings.length === 0) {
    console.log('📊 Showing loading...');
    return <Loading variant="dots" size="large" />;
  }

  try {
    console.log('🎨 Rendering PrimEarnings component...');
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
                  {isAdmin && (
                    <Button 
                      variant="outline-danger" 
                      onClick={handleCleanupDuplicates}
                      disabled={loading}
                      title="Yinelenen kesinti transaction'larını temizle"
                    >
                      🧹 Temizle
                    </Button>
                  )}
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
                {(earnings || []).map((earning, index) => (
                  <tr key={`${earning?._id?.salesperson || index}-${earning?._id?.primPeriod || index}`}>
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
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-warning">
                            Ödenmemiş:
                          </span>
                          <span className="fw-bold text-warning">
                            {formatCurrency(earning.unpaidAmount || 0)}
                          </span>
                        </div>
                        {(earning.totalDeductions < 0 || earning.deductionsCount > 0 || earning.pendingDeductionsCount > 0) && (
                          <div 
                            className="cursor-pointer"
                            onClick={() => showDeductionDetails(earning)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex justify-content-between">
                              <span className="text-danger">
                                Yapılacak Kesinti:
                              </span>
                              <span className="fw-bold text-danger">
                                {formatCurrency(earning.totalDeductions || 0)}
                              </span>
                            </div>
                            {/* Geçmişten devreden kesintileri her zaman göster (varsa tutarı, yoksa 0) */}
                            <div className="small text-muted mt-1">
                              Geçmişten Devreden Kesinti: {formatCurrency(Math.abs(earning.carriedForwardDeductions || 0))}
                            </div>
                            {earning.currentPeriodDeductions < 0 && (
                              <div className="small text-muted">
                                Yapılan Kesinti: {formatCurrency(Math.abs(earning.currentPeriodDeductions))}
                              </div>
                            )}
                            {/* Bekleyen kesintileri her zaman göster */}
                            <div 
                              className="small text-warning cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (earning.pendingDeductionsCount > 0) {
                                  showDeductionDetails(earning);
                                }
                              }}
                              style={{ cursor: earning.pendingDeductionsCount > 0 ? 'pointer' : 'default' }}
                              title={earning.pendingDeductionsCount > 0 ? 'Bekleyen kesintileri görüntülemek için tıklayın' : ''}
                            >
                              Bekleyen Kesinti: {formatCurrency(Math.abs(earning.pendingDeductions || 0))} ({earning.pendingDeductionsCount || 0} adet)
                              {earning.pendingDeductionsCount > 0 && (
                                <span className="ms-1">👆</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="h5 mb-1 text-primary">
                          {formatCurrency(earning.netUnpaidAmount || earning.unpaidAmount || 0)}
                        </div>
                        <div className="small text-muted">
                          Net Prim Hakediş
                        </div>
                        {earning.totalDeductions < 0 && (
                          <div className="small text-danger mt-1">
                            Toplam Kesinti: {formatCurrency(Math.abs(earning.totalDeductions))}
                          </div>
                        )}
                        <div className="small text-info">
                          Brüt: {formatCurrency((earning.paidAmount || 0) + (earning.unpaidAmount || 0))}
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
                            Kesinti: {earning.deductionsCount || 0}
                            {(earning.deductionsCount > 0 || earning.pendingDeductionsCount > 0) && (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="p-0 ms-1"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  showDeductionDetails(earning);
                                }}
                                title="Kesinti detaylarını göster"
                              >
                                📋
                              </Button>
                            )}
                          </span>
                        </div>
                        {earning.pendingDeductionsCount > 0 && (
                          <div className="small text-warning">
                            <FiClock className="me-1" size={12} />
                            Bekleyen: {earning.pendingDeductionsCount} adet
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="p-0 ms-1 text-warning"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showDeductionDetails(earning);
                              }}
                              title="Bekleyen kesintileri görüntüle ve onayla"
                            >
                              ⚠️
                            </Button>
                          </div>
                        )}
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

      {/* Kesinti Detayları Modal */}
      <Modal show={showDeductionModal} onHide={closeDeductionModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            📉 Kesinti Detayları - {selectedDeductions?.salesperson?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDeductions && (
            <div>
              <div className="mb-3">
                <h6>Özet Bilgiler</h6>
                <div className="row">
                  <div className="col-md-6">
                    <div className="d-flex justify-content-between">
                      <span>Toplam Kesinti:</span>
                      <span className="fw-bold text-danger">
                        {formatCurrency(selectedDeductions.totalDeductions || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex justify-content-between">
                      <span>Kesinti Sayısı:</span>
                      <span className="fw-bold">
                        {selectedDeductions.deductionsCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <h6>İptal Edilen Satışlar</h6>
              {/* Onaylanmış ve bekleyen kesintileri birleştir */}
              {(() => {
                const allDeductions = [
                  ...(selectedDeductions.deductionTransactions || []),
                  ...(selectedDeductions.pendingDeductions || [])
                ];
                return allDeductions.length > 0 ? (
                <Table responsive hover size="sm">
                  <thead>
                    <tr>
                      <th>Sözleşme No</th>
                      <th>Müşteri</th>
                      <th>Satış Tarihi</th>
                      <th>Prim Tutarı</th>
                      <th>Kesinti Tarihi</th>
                      <th>Kesinti Türü</th>
                      {isAdmin && <th>İşlemler</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allDeductions.map((transaction, index) => (
                      <tr key={transaction._id}>
                        <td>
                          <strong>{transaction.saleDetails?.contractNo || 'N/A'}</strong>
                        </td>
                        <td>{transaction.saleDetails?.customerName || 'N/A'}</td>
                        <td>
                          {transaction.saleDetails?.saleDate ? 
                            new Date(transaction.saleDetails.saleDate).toLocaleDateString('tr-TR') : 
                            'N/A'
                          }
                        </td>
                        <td>
                          <span className="text-danger fw-bold">
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </td>
                        <td>
                          {new Date(transaction.createdAt).toLocaleDateString('tr-TR')}
                        </td>
                        <td>
                          <div className="mb-1">
                            <Badge 
                              bg={transaction.description?.includes('İptalden kaynaklı') ? 'danger' : 'warning'}
                              className="small me-1"
                            >
                              {transaction.description?.includes('İptalden kaynaklı') ? 'İptalden Kaynaklı Kesinti' : 'Diğer Kesinti'}
                            </Badge>
                            {transaction.isCarriedForward && (
                              <Badge bg="info" className="small">
                                Geçmişten Devreden
                              </Badge>
                            )}
                            {transaction.isCurrentPeriodDeduction && (
                              <Badge bg="secondary" className="small">
                                Güncel Dönem
                              </Badge>
                            )}
                            {transaction.deductionStatus === 'beklemede' && (
                              <Badge bg="warning" className="small">
                                Onay Bekliyor
                              </Badge>
                            )}
                            {transaction.deductionStatus === 'yapıldı' && (
                              <Badge bg="success" className="small">
                                Onaylandı
                              </Badge>
                            )}
                          </div>
                          <div className="small text-muted">
                            {transaction.description}
                          </div>
                          {transaction.deductionPeriod && (
                            <div className="small text-info">
                              Kesinti Dönemi: {transaction.deductionPeriod.name}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            {transaction.deductionStatus === 'beklemede' && (
                              <div className="d-flex gap-1">
                                <Button
                                  type="button"
                                  variant="success"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleApproveDeduction(transaction._id);
                                  }}
                                  title="Kesinti Yap - Hakediş'ten Düş"
                                >
                                  ✓ Onayla
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCancelDeduction(transaction._id);
                                  }}
                                  title="Kesinti İptal Et"
                                >
                                  ✗ İptal
                                </Button>
                              </div>
                            )}
                            {transaction.deductionStatus === 'yapıldı' && (
                              <Badge bg="success">Onaylandı</Badge>
                            )}
                            {transaction.deductionStatus === 'iptal' && (
                              <Badge bg="secondary">İptal Edildi</Badge>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
                ) : (
                <Alert variant="info">
                  Bu temsilci için kesinti bulunmuyor.
                </Alert>
              );
              })()}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeductionModal}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
  } catch (error) {
    console.error('🚨 PrimEarnings render error:', error);
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <h4>Render Hatası</h4>
          <p>Component render edilirken hata oluştu: {error.message}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }
};

export default PrimEarnings;
