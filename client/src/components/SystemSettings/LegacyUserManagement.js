import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Form,
  Modal,
  Spinner,
  Row,
  Col,
  Badge,
  Table
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiUser, 
  FiUserPlus, 
  FiRefreshCw,
  FiArrowRight,
  FiDatabase,
  FiCalendar,
  FiUsers
} from 'react-icons/fi';

import { migrationAPI, usersAPI, salesAPI } from '../../utils/api';
import { formatDate, formatLocalDate } from '../../utils/helpers';

const LegacyUserManagement = () => {
  const [legacyUser, setLegacyUser] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Debug: users state değişimini izle
  useEffect(() => {
    console.log('🔄 Users state changed:', users);
  }, [users]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    startDate: '',
    endDate: '',
    currentUserId: '',
    useDateTime: false // Saat seçimi aktif mi?
  });
  const [stats, setStats] = useState({
    totalSales: 0,
    importedSales: 0,
    legacySales: 0
  });

  useEffect(() => {
    fetchLegacyUser();
    fetchUsers();
    fetchStats();
  }, []);

  const fetchLegacyUser = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      const legacy = response.data.find(user => user.email === 'eski.satis@legacy.system');
      setLegacyUser(legacy);
    } catch (error) {
      console.error('Legacy user fetch error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('🔍 Fetching users for assignment...');
      const response = await usersAPI.getAllUsers();
      console.log('📋 All users response:', response.data);
      
      const activeUsers = response.data.filter(user => {
        // Daha esnek filtering - sadece legacy user'ı hariç tut
        const isNotLegacy = user.email !== 'eski.satis@legacy.system';
        const hasValidRole = (user.role && user.role.name === 'salesperson') || (user.role && user.role.name === 'admin'); // Admin'leri de dahil et
        const isActiveOrApproved = user.isActive || user.isApproved; // Approved olanları da dahil et
        
        const isValid = isNotLegacy && hasValidRole && isActiveOrApproved;
        
        console.log(`👤 User ${user.name}:`, {
          role: user.role,
          isActive: user.isActive,
          isApproved: user.isApproved,
          email: user.email,
          isNotLegacy,
          hasValidRole,
          isActiveOrApproved,
          finalValid: isValid
        });
        
        return isValid;
      });
      
      console.log('✅ Filtered active users:', activeUsers);
      setUsers(activeUsers);
      
      if (activeUsers.length === 0) {
        console.warn('⚠️ No users found with current filters!');
        console.warn('🔄 Falling back to all users except legacy...');
        
        // Fallback: Sadece legacy user'ı hariç tut, diğer tüm filtreleri kaldır
        const fallbackUsers = response.data.filter(user => {
          const isNotLegacy = user.email !== 'eski.satis@legacy.system';
          const hasName = user.name && user.name.trim() !== '';
          const isValid = isNotLegacy && hasName;
          
          console.log(`🔄 Fallback user ${user.name || 'NO_NAME'}:`, {
            email: user.email,
            name: user.name,
            isNotLegacy,
            hasName,
            isValid
          });
          
          return isValid;
        });
        
        console.log('🔄 Final fallback users:', fallbackUsers);
        console.log('🔄 Setting users state with:', fallbackUsers.length, 'users');
        setUsers(fallbackUsers);
        
        if (fallbackUsers.length === 0) {
          console.error('❌ Even fallback failed! Raw data:', response.data);
          
          // Son çare: Ham veriyi direkt kullan
          console.log('🆘 Last resort: Using raw data...');
          setUsers(response.data || []);
          
          toast.error(`Hiç kullanıcı bulunamadı. Ham veri: ${response.data?.length || 0} kayıt`);
        } else {
          toast.info(`${fallbackUsers.length} kullanıcı bulundu (tüm roller dahil)`);
        }
      }
    } catch (error) {
      console.error('❌ Users fetch error:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await salesAPI.getSales({ 
        page: 1, 
        limit: 1,
        includeStats: true 
      });
      
      // İstatistikleri al (varsayılan değerler)
      setStats({
        totalSales: response.data?.totalCount || 0,
        importedSales: 0, // Bu bilgiyi API'den almak gerekebilir
        legacySales: 0    // Bu bilgiyi API'den almak gerekebilir
      });
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  const handleCreateLegacyUser = async () => {
    try {
      setCreateLoading(true);
      const response = await migrationAPI.createLegacyUser();
      
      if (response.data.success) {
        setLegacyUser(response.data.user);
        toast.success(response.data.message);
        
        if (!response.data.isExisting) {
          toast.info('Artık import edilen satışları bu kullanıcıya atayabilirsiniz!');
        }
      }
    } catch (error) {
      console.error('Create legacy user error:', error);
      toast.error(error.response?.data?.message || 'Eski Satış Temsilcisi oluşturulamadı');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAssignSales = async () => {
    try {
      setAssignLoading(true);
      
      const response = await migrationAPI.assignSalesToLegacy(assignData);
      
      if (response.data.success) {
        const selectedUser = users.find(u => u._id === assignData.currentUserId);
        const detailedMessage = `✅ ${selectedUser?.name || 'Seçilen temsilci'}'nin ${assignData.startDate} - ${assignData.endDate} tarihleri arasındaki ${response.data.salesUpdated} satışı "Eski Satış Temsilcisi"ne atandı!`;
        
        toast.success(detailedMessage, { autoClose: 5000 });
        setShowAssignModal(false);
        fetchStats(); // Refresh stats
        
        // Reset form
        setAssignData({
          startDate: '',
          endDate: '',
          currentUserId: '',
          useDateTime: false
        });
      }
    } catch (error) {
      console.error('❌ Assign sales error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Satışlar atanamadı';
      
      toast.error(`Hata: ${errorMessage}`, { autoClose: 8000 });
      
      // Debug için detayları göster
      if (error.response?.data?.details) {
        console.error('❌ Error details:', error.response.data.details);
      }
    } finally {
      setAssignLoading(false);
    }
  };

  const openAssignModal = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    setAssignData({
      startDate: formatLocalDate(yesterday),
      endDate: formatLocalDate(today),
      currentUserId: '',
      useDateTime: false
    });
    setShowAssignModal(true);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>
          <FiUser className="me-2" />
          Eski Satış Temsilcisi Yönetimi
        </h4>
        <Button variant="outline-secondary" size="sm" onClick={fetchStats}>
          <FiRefreshCw className="me-2" />
          Yenile
        </Button>
      </div>

      {/* Legacy User Status */}
      <Card className="mb-4">
        <Card.Body>
          <h6>
            <FiDatabase className="me-2" />
            Virtual Kullanıcı Durumu
          </h6>
          
          {legacyUser ? (
            <Alert variant="success">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>✅ Eski Satış Temsilcisi Mevcut</strong>
                  <div className="small text-muted mt-1">
                    ID: {legacyUser._id} | Email: {legacyUser.email}
                  </div>
                </div>
                <Badge bg="success">Aktif</Badge>
              </div>
            </Alert>
          ) : (
            <Alert variant="warning">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Eski Satış Temsilcisi Yok</strong>
                  <div className="small text-muted mt-1">
                    Import edilen satışları yönetmek için virtual kullanıcı oluşturun
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={handleCreateLegacyUser}
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <FiUserPlus className="me-2" />
                      Oluştur
                    </>
                  )}
                </Button>
              </div>
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Statistics */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-primary">{stats.totalSales}</h3>
              <small className="text-muted">Toplam Satış</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-warning">{stats.importedSales}</h3>
              <small className="text-muted">Import Edilen</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-success">{stats.legacySales}</h3>
              <small className="text-muted">Eski Temsilciye Ait</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      {legacyUser && (
        <Card>
          <Card.Body>
            <h6>
              <FiArrowRight className="me-2" />
              Satış Atama İşlemleri
            </h6>
            <p className="text-muted">
              Import ettiğiniz satışları "Eski Satış Temsilcisi"ne atayarak performans analizlerini düzenleyin.
            </p>
            
            <Button 
              variant="primary"
              onClick={openAssignModal}
            >
              <FiUsers className="me-2" />
              Satışları Ata
            </Button>
          </Card.Body>
        </Card>
      )}

      {/* Assign Sales Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiArrowRight className="me-2" />
            Satışları Eski Satış Temsilcisine Ata
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Alert variant="info">
            <strong>📋 Bu işlem:</strong>
            <ul className="mb-0 mt-2">
              <li><strong>Seçilen temsilcinin</strong> belirtilen <strong>tarih ve saat aralığında kaydedilen</strong> satışlarını "Eski Satış Temsilcisi"ne atar</li>
              <li>Performans raporlarında bu satışlar <strong>performans hesaplamalarına dahil edilmez</strong></li>
              <li>Orijinal temsilci bilgisi korunur (geri alınabilir)</li>
              <li>Örnek: "Selçuk TUNÇER'in 08.09.2025 14:00 - 18:00 arasında kaydedilen satışları"</li>
            </ul>
          </Alert>

          {/* Saat seçimi toggle */}
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="datetime-switch"
              label="🕐 Saat bazlı filtreleme (kaydedilme zamanı)"
              checked={assignData.useDateTime}
              onChange={(e) => setAssignData(prev => ({
                ...prev,
                useDateTime: e.target.checked,
                // Toggle değiştiğinde tarihleri resetle
                startDate: '',
                endDate: ''
              }))}
            />
            <Form.Text className="text-muted">
              {assignData.useDateTime 
                ? "Belirli saat aralığında kaydedilen satışları filtreler"
                : "Tüm gün boyunca kaydedilen satışları filtreler"
              }
            </Form.Text>
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  {assignData.useDateTime ? 'Başlangıç Tarihi ve Saati' : 'Başlangıç Tarihi'}
                </Form.Label>
                <Form.Control
                  type={assignData.useDateTime ? "datetime-local" : "date"}
                  value={assignData.startDate}
                  onChange={(e) => setAssignData(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  {assignData.useDateTime ? 'Bitiş Tarihi ve Saati' : 'Bitiş Tarihi'}
                </Form.Label>
                <Form.Control
                  type={assignData.useDateTime ? "datetime-local" : "date"}
                  value={assignData.endDate}
                  onChange={(e) => setAssignData(prev => ({
                    ...prev,
                    endDate: e.target.value
                  }))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>
              <strong>Hangi Temsilcinin Satışları? *</strong>
            </Form.Label>
            <Form.Select
              value={assignData.currentUserId}
              onChange={(e) => {
                console.log('🔄 User selection changed:', e.target.value);
                setAssignData(prev => ({
                  ...prev,
                  currentUserId: e.target.value
                }));
              }}
              required
            >
              <option value="">🔽 Temsilci Seçin ({users.length} temsilci)</option>
              {users.length === 0 ? (
                <option disabled>Temsilci bulunamadı</option>
              ) : (
                users.map(user => {
                  console.log('📝 Rendering user option:', user);
                  return (
                    <option key={user._id} value={user._id}>
                      👤 {user.name} ({user.email})
                    </option>
                  );
                })
              )}
            </Form.Select>
            <Form.Text className="text-muted">
              <strong>Örnek:</strong> "Selçuk TUNÇER" seçerseniz, sadece onun belirtilen tarih aralığındaki satışları atanır
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAssignSales}
            disabled={assignLoading || !assignData.startDate || !assignData.endDate || !assignData.currentUserId}
          >
            {assignLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Atanıyor...
              </>
            ) : (
              <>
                <FiArrowRight className="me-2" />
                Ata
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LegacyUserManagement;
