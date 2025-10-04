import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Button, 
  Alert, 
  Row, 
  Col,
  Badge,
  Modal,
  Table
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiMessageSquare, 
  FiPhone, 
  FiPhoneCall, 
  FiUsers,
  FiSave,
  FiClock,
  FiCheck,
  FiAlertTriangle,
  FiEye,
  FiCalendar
} from 'react-icons/fi';

import { communicationsAPI, dailyStatusAPI, communicationYearAPI, communicationTypesAPI } from '../../utils/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import Loading from '../Common/Loading';

const DailyCommunicationEntry = () => {
  const [todayData, setTodayData] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [deadlineTime, setDeadlineTime] = useState({ hour: 23, minute: 0 }); // Varsayılan 23:00
  const [communicationTypes, setCommunicationTypes] = useState([]);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchTodayData();
    fetchDailyStatus();
    fetchDeadlineSettings();
    fetchCommunicationTypes();
  }, []);

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      const response = await communicationsAPI.getToday();
      const data = response.data;
      
      setTodayData(data);
      
      if (data.isEntered) {
        setFormData({
          whatsappIncoming: data.whatsappIncoming || 0,
          callIncoming: data.callIncoming || 0,
          callOutgoing: data.callOutgoing || 0,
          meetingNewCustomer: data.meetingNewCustomer || 0,
          meetingAfterSale: data.meetingAfterSale || 0
        });
      }
    } catch (error) {
      console.error('Today data fetch error:', error);
      toast.error('Bugünkü veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyStatus = async () => {
    try {
      const response = await dailyStatusAPI.getMyStatus();
      setDailyStatus(response.data);
    } catch (error) {
      console.error('Daily status fetch error:', error);
    }
  };

  const fetchDeadlineSettings = async () => {
    try {
      const response = await communicationYearAPI.getCurrentSettings();
      const settings = response.data.settings;
      
      // Eski entryDeadlineHour'u yeni formata çevir
      let entryDeadlineTime = { hour: 23, minute: 0 };
      if (settings.entryDeadlineTime) {
        entryDeadlineTime = settings.entryDeadlineTime;
      } else if (settings.entryDeadlineHour !== undefined) {
        // Geriye uyumluluk için eski alanı kullan
        entryDeadlineTime = { hour: settings.entryDeadlineHour, minute: 0 };
      }
      
      setDeadlineTime(entryDeadlineTime);
    } catch (error) {
      console.error('Deadline settings fetch error:', error);
      // Hata durumunda varsayılan değeri koru
    }
  };

  const fetchCommunicationTypes = async () => {
    try {
      const response = await communicationTypesAPI.getAll({ active: 'true' });
      const types = response.data || [];
      setCommunicationTypes(types);
      
      // FormData'yı iletişim türlerine göre initialize et
      const initialFormData = {};
      types.forEach(type => {
        initialFormData[type.code] = 0;
      });
      setFormData(initialFormData);
    } catch (error) {
      console.error('Fetch communication types error:', error);
      toast.error('İletişim türleri yüklenirken hata oluştu');
    }
  };

  const handleInputChange = (field, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      console.log('=== SAVING DAILY DATA ===');
      console.log('Form data to save:', formData);
      
      const response = await communicationsAPI.saveDaily(formData);
      
      console.log('Save response:', response);
      toast.success('Günlük iletişim verileriniz kaydedildi');
      setTodayData(response.data);
      
    } catch (error) {
      console.error('Save daily communication error:', error);
      toast.error(error.response?.data?.message || 'Veriler kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await communicationsAPI.getRecords({
        limit: 30
      });
      setHistory(response.data);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('History fetch error:', error);
      toast.error('Geçmiş veriler yüklenirken hata oluştu');
    }
  };

  const getTotalMeetings = () => {
    return communicationTypes
      .filter(type => type.category === 'meeting')
      .reduce((total, type) => total + (formData[type.code] || 0), 0);
  };

  const getTotalCommunication = () => {
    return communicationTypes
      .reduce((total, type) => total + (formData[type.code] || 0), 0);
  };

  const getIconComponent = (iconName) => {
    const iconMap = {
      FiMessageCircle: FiMessageSquare,
      FiPhone: FiPhone,
      FiPhoneCall: FiPhoneCall,
      FiUsers: FiUsers,
      FiMail: FiMessageSquare,
      FiVideo: FiUsers,
      FiMapPin: FiUsers,
      FiUser: FiUsers,
      FiUserCheck: FiUsers,
      FiTrendingUp: FiUsers,
      FiTarget: FiUsers,
      FiAward: FiUsers,
      FiStar: FiUsers,
      FiHeart: FiUsers
    };
    
    const IconComponent = iconMap[iconName] || FiMessageSquare;
    return <IconComponent />;
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      incoming: 'text-success',
      outgoing: 'text-primary', 
      meeting: 'text-info',
      other: 'text-secondary'
    };
    return colorMap[category] || 'text-secondary';
  };

  const getDeadlineStatus = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const deadlineHour = deadlineTime.hour;
    const deadlineMinute = deadlineTime.minute;
    
    // Mevcut zamanı dakika cinsinden hesapla
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const deadlineTimeInMinutes = deadlineHour * 60 + deadlineMinute;
    
    if (currentTimeInMinutes >= deadlineTimeInMinutes) {
      return { variant: 'danger', text: 'Son tarih geçti!' };
    } else if (currentTimeInMinutes >= deadlineTimeInMinutes - 60) { // 1 saat öncesi
      return { variant: 'warning', text: 'Son 1 saat!' };
    } else if (currentTimeInMinutes >= deadlineTimeInMinutes - 180) { // 3 saat öncesi
      const remainingHours = Math.ceil((deadlineTimeInMinutes - currentTimeInMinutes) / 60);
      return { variant: 'info', text: `${remainingHours} saat kaldı` };
    } else {
      return { variant: 'success', text: 'Zamanında' };
    }
  };

  if (loading) {
    return <Loading variant="dots" size="large" />;
  }

  const deadlineStatus = getDeadlineStatus();
  const isExempt = dailyStatus && ['izinli', 'hastalik', 'resmi_tatil'].includes(dailyStatus.status);

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiMessageSquare className="me-2" />
            Günlük İletişim Kaydı
          </h4>
          <p className="text-muted mb-0">
            Bugün ({formatDate(new Date())}) gerçekleştirdiğiniz iletişim faaliyetlerini kaydedin
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchHistory}>
            <FiEye className="me-1" />
            Geçmiş
          </Button>
          <Button variant="outline-primary" onClick={fetchTodayData}>
            <FiCalendar className="me-1" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {isExempt && (
        <Alert variant="info" className="mb-4">
          <FiCheck className="me-2" />
          <strong>Durum:</strong> Bugün "{dailyStatus.statusDisplay}" durumundasınız. 
          İletişim kaydı girme zorunluluğunuz bulunmamaktadır.
        </Alert>
      )}

      {!isExempt && (
        <Alert variant={deadlineStatus.variant} className="mb-4">
          <FiClock className="me-2" />
          <strong>Son Tarih:</strong> Saat {deadlineTime.hour.toString().padStart(2, '0')}:{deadlineTime.minute.toString().padStart(2, '0')}'a kadar girmeniz gerekiyor. ({deadlineStatus.text})
        </Alert>
      )}

      {todayData?.isEntered && (
        <Alert variant="success" className="mb-4">
          <FiCheck className="me-2" />
          <strong>Tamamlandı:</strong> Bugünkü verileriniz {formatDateTime(todayData.enteredAt)} tarihinde kaydedildi.
          {!isExempt && " Güncelleme yapabilirsiniz."}
        </Alert>
      )}

      {/* Data Entry Form */}
      <Row>
        <Col lg={8}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">İletişim Verileri</h6>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  {communicationTypes.map((type, index) => (
                    <Col md={6} className="mb-3" key={type._id}>
                      <Form.Group>
                        <Form.Label>
                          <span className={`me-2 ${getCategoryColor(type.category)}`} style={{ color: type.color }}>
                            {getIconComponent(type.icon)}
                          </span>
                          {type.name}
                          {type.isRequired && <span className="text-danger ms-1">*</span>}
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={type.minValue}
                          max={type.maxValue || undefined}
                          value={formData[type.code] || 0}
                          onChange={(e) => handleInputChange(type.code, e.target.value)}
                          placeholder="0"
                          disabled={isExempt}
                          required={type.isRequired}
                        />
                        <Form.Text className="text-muted">
                          {type.description}
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  ))}
                  
                  {communicationTypes.length === 0 && (
                    <Col md={12}>
                      <Alert variant="info" className="text-center">
                        <FiMessageSquare className="me-2" />
                        Henüz iletişim türü tanımlanmamış. Lütfen sistem yöneticisi ile iletişime geçin.
                      </Alert>
                    </Col>
                  )}

                </Row>

                {!isExempt && (
                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      size="lg"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" />
                          Kaydediliyor...
                        </>
                      ) : (
                        <>
                          <FiSave className="me-2" />
                          {todayData?.isEntered ? 'Güncelle' : 'Kaydet'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Summary */}
        <Col lg={4}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Özet</h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Toplam Görüşme:</span>
                  <Badge bg="primary">{getTotalMeetings()}</Badge>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Toplam İletişim:</span>
                  <Badge bg="success">{getTotalCommunication()}</Badge>
                </div>
              </div>

              <hr />

              <div className="small text-muted">
                <div className="mb-2">
                  <strong>Detay:</strong>
                </div>
                {communicationTypes.map(type => (
                  <div key={type._id}>
                    {type.name}: {formData[type.code] || 0}
                  </div>
                ))}
              </div>

              {!isExempt && getTotalCommunication() === 0 && (
                <Alert variant="warning" className="mt-3 small">
                  <FiAlertTriangle className="me-1" />
                  En az bir iletişim faaliyeti girmeniz önerilir.
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Daily Status Card */}
          {dailyStatus && (
            <Card className="mt-3">
              <Card.Header>
                <h6 className="mb-0">Bugünkü Durumunuz</h6>
              </Card.Header>
              <Card.Body>
                <div className="text-center">
                  <Badge 
                    bg={dailyStatus.status === 'mesaide' ? 'success' : 'warning'} 
                    className="mb-2"
                  >
                    {dailyStatus.statusDisplay}
                  </Badge>
                  {dailyStatus.statusNote && (
                    <div className="small text-muted">
                      {dailyStatus.statusNote}
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* History Modal */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiEye className="me-2" />
            İletişim Geçmişi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Tarih</th>
                {communicationTypes.map(type => (
                  <th key={type._id}>{type.name}</th>
                ))}
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record._id}>
                  <td>{formatDate(record.date)}</td>
                  {communicationTypes.map(type => (
                    <td key={type._id}>{record[type.code] || 0}</td>
                  ))}
                  <td>
                    <Badge bg="primary">{record.totalCommunication}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DailyCommunicationEntry;
