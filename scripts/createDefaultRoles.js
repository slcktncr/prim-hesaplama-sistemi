const mongoose = require('mongoose');
require('../config/db')();

const Role = require('../models/Role');
const User = require('../models/User');

const createDefaultRoles = async () => {
  try {
    console.log('🔧 Varsayılan roller oluşturuluyor...');

    // Admin kullanıcısını bul
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ Admin kullanıcı bulunamadı. Önce admin kullanıcı oluşturun.');
      process.exit(1);
    }

    // Mevcut rolleri kontrol et
    const existingRoles = await Role.find({});
    console.log(`📊 Mevcut rol sayısı: ${existingRoles.length}`);

    const defaultRoles = [
      {
        name: 'admin',
        displayName: 'Sistem Yöneticisi',
        description: 'Tüm sistem yetkilerine sahip süper kullanıcı',
        isSystemRole: true,
        permissions: {
          // Genel Yetkiler
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          
          // Satış Yetkileri
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: true,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: true,
          
          // Prim Yetkileri
          canViewPrims: true,
          canManagePrimPeriods: true,
          canEditPrimRates: true,
          canProcessPayments: true,
          canViewAllEarnings: true,
          
          // İletişim Yetkileri
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          
          // Kullanıcı Yönetimi
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canManageRoles: true,
          
          // Sistem Yönetimi
          canAccessSystemSettings: true,
          canManageBackups: true,
          canViewSystemLogs: true,
          canManageAnnouncements: true,
          
          // Özel Yetkiler
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: true
        }
      },
      {
        name: 'salesperson',
        displayName: 'Satış Temsilcisi',
        description: 'Standart satış temsilcisi yetkileri',
        isSystemRole: true,
        permissions: {
          // Genel Yetkiler
          canViewDashboard: true,
          canViewReports: true,
          canExportData: false,
          
          // Satış Yetkileri
          canViewSales: true,
          canCreateSales: true,
          canEditSales: false,
          canDeleteSales: false,
          canViewAllSales: true, // Artık herkes herkesi görebilir
          canTransferSales: false,
          canCancelSales: false,
          canModifySales: false,
          canImportSales: false,
          
          // Prim Yetkileri
          canViewPrims: true,
          canManagePrimPeriods: false,
          canEditPrimRates: false,
          canProcessPayments: false,
          canViewAllEarnings: true, // Artık herkes herkesi görebilir
          
          // İletişim Yetkileri
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true, // Artık herkes herkesi görebilir
          
          // Kullanıcı Yönetimi
          canViewUsers: false,
          canCreateUsers: false,
          canEditUsers: false,
          canDeleteUsers: false,
          canManageRoles: false,
          
          // Sistem Yönetimi
          canAccessSystemSettings: false,
          canManageBackups: false,
          canViewSystemLogs: false,
          canManageAnnouncements: false,
          
          // Özel Yetkiler
          canViewPenalties: false,
          canApplyPenalties: false,
          canOverrideValidations: false
        }
      },
      {
        name: 'sales_manager',
        displayName: 'Satış Müdürü',
        description: 'Satış ekibini yöneten orta düzey yönetici',
        isSystemRole: false,
        permissions: {
          // Genel Yetkiler
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          
          // Satış Yetkileri
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: false,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: false,
          
          // Prim Yetkileri
          canViewPrims: true,
          canManagePrimPeriods: false,
          canEditPrimRates: false,
          canProcessPayments: true,
          canViewAllEarnings: true,
          
          // İletişim Yetkileri
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          
          // Kullanıcı Yönetimi
          canViewUsers: true,
          canCreateUsers: false,
          canEditUsers: false,
          canDeleteUsers: false,
          canManageRoles: false,
          
          // Sistem Yönetimi
          canAccessSystemSettings: false,
          canManageBackups: false,
          canViewSystemLogs: false,
          canManageAnnouncements: true,
          
          // Özel Yetkiler
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: false
        }
      },
      {
        name: 'viewer',
        displayName: 'Görüntüleyici',
        description: 'Sadece görüntüleme yetkisi olan kullanıcı',
        isSystemRole: false,
        permissions: {
          // Genel Yetkiler
          canViewDashboard: true,
          canViewReports: true,
          canExportData: false,
          
          // Satış Yetkileri
          canViewSales: true,
          canCreateSales: false,
          canEditSales: false,
          canDeleteSales: false,
          canViewAllSales: true,
          canTransferSales: false,
          canCancelSales: false,
          canModifySales: false,
          canImportSales: false,
          
          // Prim Yetkileri
          canViewPrims: true,
          canManagePrimPeriods: false,
          canEditPrimRates: false,
          canProcessPayments: false,
          canViewAllEarnings: true,
          
          // İletişim Yetkileri
          canViewCommunications: true,
          canEditCommunications: false,
          canViewAllCommunications: true,
          
          // Kullanıcı Yönetimi
          canViewUsers: false,
          canCreateUsers: false,
          canEditUsers: false,
          canDeleteUsers: false,
          canManageRoles: false,
          
          // Sistem Yönetimi
          canAccessSystemSettings: false,
          canManageBackups: false,
          canViewSystemLogs: false,
          canManageAnnouncements: false,
          
          // Özel Yetkiler
          canViewPenalties: false,
          canApplyPenalties: false,
          canOverrideValidations: false
        }
      }
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (existingRole) {
        console.log(`⚠️ Rol zaten mevcut: ${roleData.displayName}`);
        continue;
      }

      const role = new Role({
        ...roleData,
        createdBy: adminUser._id
      });

      await role.save();
      console.log(`✅ Rol oluşturuldu: ${roleData.displayName}`);
    }

    console.log('🎉 Varsayılan roller başarıyla oluşturuldu!');
    
  } catch (error) {
    console.error('❌ Rol oluşturma hatası:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Script çalıştırıldığında
if (require.main === module) {
  createDefaultRoles();
}

module.exports = createDefaultRoles;
