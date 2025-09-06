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

import { communicationsAPI, dailyStatusAPI } from '../../utils/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import Loading from '../Common/Loading';

const DailyCommunicationEntry = () => {
  const [todayData, setTodayData] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [formData, setFormData] = useState({
    whatsappIncoming: 0,
    callIncoming: 0,
    callOutgoing: 0,
    meetingNewCustomer: 0,
    meetingAfterSale: 0
  });

  useEffect(() => {
    fetchTodayData();
    fetchDailyStatus();
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
      
      const response = await communicationsAPI.saveDaily(formData);
      
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
    return formData.meetingNewCustomer + formData.meetingAfterSale;
  };

  const getTotalCommunication = () => {
    return formData.whatsappIncoming + formData.callIncoming + formData.callOutgoing + getTotalMeetings();
  };

  const getDeadlineStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 23) {
      return { variant: 'danger', text: 'Son tarih geçti!' };
    } else if (hour >= 22) {
      return { variant: 'warning', text: 'Son 1 saat!' };
    } else if (hour >= 20) {
      return { variant: 'info', text: `${23 - hour} saat kaldı` };
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
          <strong>Son Tarih:</strong> Saat 23:00'a kadar girmeniz gerekiyor. ({deadlineStatus.text})
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
                  {/* WhatsApp */}
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>
                        <FiMessageSquare className="me-2 text-success" />
                        Gelen WhatsApp
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={formData.whatsappIncoming}
                        onChange={(e) => handleInputChange('whatsappIncoming', e.target.value)}
                        placeholder="0"
                        disabled={isExempt}
                      />
                      <Form.Text className="text-muted">
                        Bugün aldığınız WhatsApp mesaj sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  {/* Gelen Arama */}
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>
                        <FiPhone className="me-2 text-primary" />
                        Gelen Arama
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={formData.callIncoming}
                        onChange={(e) => handleInputChange('callIncoming', e.target.value)}
                        placeholder="0"
                        disabled={isExempt}
                      />
                      <Form.Text className="text-muted">
                        Size gelen telefon araması sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  {/* Giden Arama */}
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>
                        <FiPhoneCall className="me-2 text-warning" />
                        Giden Arama
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={formData.callOutgoing}
                        onChange={(e) => handleInputChange('callOutgoing', e.target.value)}
                        placeholder="0"
                        disabled={isExempt}
                      />
                      <Form.Text className="text-muted">
                        Yaptığınız telefon araması sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  {/* Yeni Müşteri Görüşmesi */}
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>
                        <FiUsers className="me-2 text-info" />
                        Yeni Müşteri Görüşmesi
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={formData.meetingNewCustomer}
                        onChange={(e) => handleInputChange('meetingNewCustomer', e.target.value)}
                        placeholder="0"
                        disabled={isExempt}
                      />
                      <Form.Text className="text-muted">
                        Yeni müşterilerle birebir görüşme sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  {/* Satış Sonrası Görüşme */}
                  <Col md={12} className="mb-3">
                    <Form.Group>
                      <Form.Label>
                        <FiUsers className="me-2 text-secondary" />
                        Satış Sonrası Görüşme
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={formData.meetingAfterSale}
                        onChange={(e) => handleInputChange('meetingAfterSale', e.target.value)}
                        placeholder="0"
                        disabled={isExempt}
                      />
                      <Form.Text className="text-muted">
                        Mevcut müşterilerle satış sonrası birebir görüşme sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>
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
                <div>WhatsApp: {formData.whatsappIncoming}</div>
                <div>Gelen Arama: {formData.callIncoming}</div>
                <div>Giden Arama: {formData.callOutgoing}</div>
                <div>Yeni Müşteri: {formData.meetingNewCustomer}</div>
                <div>Satış Sonrası: {formData.meetingAfterSale}</div>
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
                <th>WhatsApp</th>
                <th>Gelen</th>
                <th>Giden</th>
                <th>Yeni Müşteri</th>
                <th>Satış Sonrası</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record._id}>
                  <td>{formatDate(record.date)}</td>
                  <td>{record.whatsappIncoming}</td>
                  <td>{record.callIncoming}</td>
                  <td>{record.callOutgoing}</td>
                  <td>{record.meetingNewCustomer}</td>
                  <td>{record.meetingAfterSale}</td>
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
