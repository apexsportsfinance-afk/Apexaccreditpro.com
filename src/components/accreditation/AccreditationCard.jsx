import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { calculateAge, getCountryName } from "../../lib/utils";

const A5_WIDTH = 420;
const A5_HEIGHT = 595;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff"
  },
  frontCard: {
    width: "100%",
    height: "100%",
    position: "relative",
    backgroundColor: "#ffffff",
    flexDirection: "column"
  },
  headerSection: {
    flexDirection: "row",
    height: 80,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc"
  },
  headerLeft: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  headerCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  headerRight: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  headerLogo: {
    width: 55,
    height: 55,
    objectFit: "contain"
  },
  headerTitleEn: {
    fontSize: 10,
    color: "#1e3a8a",
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    textTransform: "uppercase",
    maxWidth: 140
  },
  headerTitleAr: {
    fontSize: 11,
    color: "#1e3a8a",
    fontFamily: "Helvetica",
    textAlign: "left"
  },
  headerSubtitle: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right",
    marginTop: 2
  },
  roleBanner: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    width: "100%"
  },
  roleText: {
    fontSize: 22,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 3
  },
  bodySection: {
    flex: 1,
    flexDirection: "row",
    padding: 20
  },
  leftColumn: {
    flex: 1.2,
    paddingRight: 12,
    justifyContent: "flex-start"
  },
  rightColumn: {
    width: 140,
    alignItems: "center"
  },
  nameContainer: {
    marginBottom: 5,
    maxHeight: 56
  },
  clubText: {
    fontSize: 14,
    color: "#0f172a",
    fontFamily: "Helvetica",
    marginBottom: 14
  },
  detailRow: {
    marginBottom: 3
  },
  detailText: {
    fontSize: 13,
    color: "#334155",
    fontFamily: "Helvetica"
  },
  nationalityText: {
    fontSize: 14,
    color: "#1e3a8a",
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 6
  },
  flagImage: {
    width: 56,
    height: 35,
    borderRadius: 3,
    marginTop: 6
  },
  photoContainer: {
    width: 125,
    height: 155,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 3,
    marginBottom: 8,
    backgroundColor: "#ffffff"
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    objectFit: "cover"
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  idText: {
    fontSize: 12,
    color: "#0f172a",
    fontFamily: "Helvetica",
    textAlign: "center"
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "center"
  },
  zoneSection: {
    height: 60,
    backgroundColor: "#003d52",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 3,
    borderTopColor: "#ffffff"
  },
  zoneText: {
    color: "#ffffff",
    fontSize: 32,
    fontFamily: "Helvetica-Bold"
  },
  zoneDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255,255,255,0.3)"
  },
  sponsorSection: {
    height: 55,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  sponsorLogo: {
    height: 28,
    width: 60,
    objectFit: "contain"
  },
  backPage: {
    width: "100%",
    height: "100%"
  },
  backPageImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  backPageDefault: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0f172a",
    padding: 24
  },
  backHeader: {
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "Helvetica-Bold"
  },
  accessZonesTitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 10,
    fontFamily: "Helvetica-Bold"
  },
  zoneList: {
    marginBottom: 16
  },
  zoneItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  zoneItemBadge: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  zoneItemText: {
    fontSize: 13,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold"
  },
  zoneItemName: {
    fontSize: 12,
    color: "#e2e8f0"
  },
  reportingSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8
  },
  reportingTitle: {
    fontSize: 12,
    color: "#fbbf24",
    marginBottom: 4,
    fontFamily: "Helvetica-Bold"
  },
  reportingText: {
    fontSize: 10,
    color: "#e2e8f0"
  }
});

const roleColorSchemes = {
  athlete: "#2563eb",
  coach: "#0d9488",
  media: "#d97706",
  official: "#7c3aed",
  medical: "#e11d48",
  staff: "#475569",
  vip: "#b45309"
};

const getRoleColor = (role) => {
  const key = role?.toLowerCase() || "default";
  return roleColorSchemes[key] || "#475569";
};

const getZoneColor = (zones, code) => {
  const zone = zones?.find(z => z.code === code);
  return zone?.color || "#2563eb";
};

const getNameFontSize = (firstName, lastName) => {
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  const len = fullName.length;
  if (len > 28) return 14;
  if (len > 22) return 17;
  if (len > 16) return 19;
  return 22;
};

const AccreditationCard = ({ accreditation, event, zones, preloadedImages = {} }) => {
  // Match role banner color to zone color coding
  const matchingZone = zones?.find(z => z.name?.toLowerCase() === accreditation?.role?.toLowerCase());
  const roleBg = matchingZone?.color || getRoleColor(accreditation?.role);
  const zoneCodes = accreditation?.zoneCode?.split(",").map(z => z.trim()).filter(Boolean) || [];
  const photoSrc = preloadedImages.photo || null;
  const logoSrc = preloadedImages.logo || null;
  const flagSrc = preloadedImages.flag || null;
  const backTemplateSrc = preloadedImages.backTemplate || null;
  const sponsorLogosSrc = preloadedImages.sponsors || [];

  const countryName = getCountryName(accreditation?.nationality);
  const age = accreditation?.dateOfBirth && event?.ageCalculationYear 
    ? calculateAge(accreditation.dateOfBirth, event.ageCalculationYear) 
    : null;

  const nameFontSize = getNameFontSize(accreditation?.firstName, accreditation?.lastName);
  const fullName = `${accreditation?.firstName || "FIRST"} ${accreditation?.lastName || "LAST"}`;

  const showSubtitle = event?.headerSubtitle && 
    event.headerSubtitle.toLowerCase() !== event?.name?.toLowerCase();

  return (
    <Document>
      {/* FRONT PAGE */}
      <Page size={[A5_WIDTH, A5_HEIGHT]} style={styles.page}>
        <View style={styles.frontCard}>
          <View style={styles.headerSection}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitleAr}>{event?.headerArabic || ""}</Text>
            </View>
            <View style={styles.headerCenter}>
              {logoSrc ? <Image src={logoSrc} style={styles.headerLogo} /> : null}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerTitleEn}>{event?.name || "EVENT NAME"}</Text>
              {showSubtitle && (
                <Text style={styles.headerSubtitle}>{event.headerSubtitle}</Text>
              )}
            </View>
          </View>

          <View style={[styles.roleBanner, { backgroundColor: roleBg }]}>
            <Text style={styles.roleText}>{accreditation?.role || "PARTICIPANT"}</Text>
          </View>

          <View style={styles.bodySection}>
            <View style={styles.leftColumn}>
              <View style={styles.nameContainer}>
                <Text style={{
                  fontSize: nameFontSize,
                  color: "#1e3a8a",
                  fontFamily: "Helvetica-Bold",
                  textTransform: "uppercase",
                  lineHeight: 1.15
                }}>
                  {fullName}
                </Text>
              </View>
              <Text style={styles.clubText}>{accreditation?.club || "Club Name"}</Text>

              {age !== null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailText}>{age} Y old</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailText}>{accreditation?.gender || "Gender"}</Text>
              </View>

              <Text style={styles.nationalityText}>{countryName}</Text>
              {flagSrc ? (
                <Image src={flagSrc} style={styles.flagImage} />
              ) : null}
            </View>

            <View style={styles.rightColumn}>
              <View style={styles.photoContainer}>
                {photoSrc ? (
                  <Image src={photoSrc} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={{fontSize: 24, color: "#94a3b8"}}>No Photo</Text>
                  </View>
                )}
              </View>
              <Text style={styles.idText}>ID: {accreditation?.accreditationId?.split("-")?.pop() || "---"}</Text>
              <Text style={styles.badgeText}>Badge: {accreditation?.badgeNumber || "---"}</Text>
            </View>
          </View>

          <View style={{flex: 1}} />

          <View style={styles.zoneSection}>
            {zoneCodes.length > 0 ? (
              zoneCodes.slice(0, 4).map((code, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <View style={styles.zoneDivider} />}
                  <Text style={styles.zoneText}>{code}</Text>
                </React.Fragment>
              ))
            ) : (
              <Text style={[styles.zoneText, {fontSize: 18}]}>NO ACCESS</Text>
            )}
          </View>

          <View style={styles.sponsorSection}>
            {sponsorLogosSrc.length > 0 ? (
              sponsorLogosSrc.slice(0, 4).map((logo, index) => 
                logo ? <Image key={index} src={logo} style={styles.sponsorLogo} /> : null
              )
            ) : (
              <Text style={{fontSize: 10, color: "#94a3b8"}}>Sponsors</Text>
            )}
          </View>
        </View>
      </Page>

      {/* BACK PAGE */}
      <Page size={[A5_WIDTH, A5_HEIGHT]} style={styles.page}>
        {backTemplateSrc ? (
          <View style={styles.backPage}>
            <Image src={backTemplateSrc} style={styles.backPageImage} />
          </View>
        ) : (
          <View style={styles.backPageDefault}>
            <Text style={styles.backHeader}>{event?.name || "Event Name"}</Text>
            <Text style={styles.accessZonesTitle}>ACCESS</Text>
            <View style={styles.zoneList}>
              {zoneCodes.map((code, index) => {
                const zoneInfo = zones?.find(z => z.code === code);
                return (
                  <View key={index} style={styles.zoneItem}>
                    <View style={[styles.zoneItemBadge, { backgroundColor: getZoneColor(zones, code) }]}>
                      <Text style={styles.zoneItemText}>{code}</Text>
                    </View>
                    <Text style={styles.zoneItemName}>{zoneInfo?.name || code}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.reportingSection}>
              <Text style={styles.reportingTitle}>IMPORTANT</Text>
              <Text style={styles.reportingText}>
                This accreditation must be worn visibly at all times. Access is restricted to authorized zones only.
              </Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default AccreditationCard;