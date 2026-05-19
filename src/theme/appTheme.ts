import { StyleSheet } from 'react-native';

import { ThemeChoice, ThemeColors } from './types';

export const flexoki: Record<'light' | 'dark', ThemeColors> = {
  light: {
    bg: '#FFFCF0',
    bg2: '#F2F0E5',
    ui: '#E6E4D9',
    ui2: '#DAD8CE',
    tx: '#100F0F',
    tx2: '#6F6E69',
    tx3: '#B7B5AC',
    accent: '#24837B',
    accent2: '#205EA6',
    red: '#AF3029',
    yellow: '#AD8301',
    overlay: 'rgba(16, 15, 15, 0.35)',
    status: 'dark'
  },
  dark: {
    bg: '#100F0F',
    bg2: '#1C1B1A',
    ui: '#282726',
    ui2: '#403E3C',
    tx: '#CECDC3',
    tx2: '#878580',
    tx3: '#575653',
    accent: '#3AA99F',
    accent2: '#4385BE',
    red: '#D14D41',
    yellow: '#D0A215',
    overlay: 'rgba(16, 15, 15, 0.62)',
    status: 'light'
  }
};

export function themeLabel(choice: ThemeChoice) {
  switch (choice) {
    case 'system':
      return 'System';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
  }
}

export function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg
    },
    app: {
      flex: 1,
      backgroundColor: colors.bg
    },
    topBar: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      left: 0,
      paddingBottom: 12,
      paddingHorizontal: 16,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 20
    },
    titleBlock: {
      flex: 1,
      minWidth: 0
    },
    title: {
      color: colors.tx,
      fontSize: 22,
      fontWeight: '800'
    },
    subtitle: {
      color: colors.tx2,
      fontSize: 12,
      marginTop: 2
    },
    settingsButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    settingsButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    searchWrap: {
      left: 16,
      position: 'absolute',
      right: 16,
      zIndex: 30
    },
    searchInput: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      fontSize: 16,
      height: 48,
      paddingHorizontal: 14,
      textAlignVertical: 'center'
    },
    searchPlaceholder: {
      color: colors.tx2
    },
    searchResults: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 8,
      overflow: 'hidden'
    },
    searchPage: {
      backgroundColor: colors.bg,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 110
    },
    searchPageHeader: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingBottom: 12,
      paddingHorizontal: 16
    },
    searchPageInput: {
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      flex: 1,
      fontSize: 16,
      height: 44,
      paddingHorizontal: 12
    },
    searchPageContent: {
      paddingBottom: 40,
      paddingHorizontal: 16,
      paddingTop: 12
    },
    searchResultRow: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12
    },
    resultCode: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '900',
      width: 56
    },
    resultTextBlock: {
      flex: 1,
      minWidth: 0
    },
    resultName: {
      color: colors.tx,
      fontWeight: '800'
    },
    resultRoad: {
      color: colors.tx2,
      fontSize: 12,
      marginTop: 2
    },
    locationButtonWrap: {
      left: 16,
      position: 'absolute',
      zIndex: 35
    },
    locationButton: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    drawer: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 1,
      bottom: 0,
      left: 0,
      paddingBottom: 8,
      paddingHorizontal: 16,
      position: 'absolute',
      right: 0,
      zIndex: 40
    },
    drawerHandleArea: {
      alignItems: 'center',
      height: 30,
      justifyContent: 'center'
    },
    drawerHandle: {
      backgroundColor: colors.ui2,
      borderRadius: 8,
      height: 5,
      width: 54
    },
    drawerScrollContent: {
      paddingBottom: 28
    },
    drawerStickyHeader: {
      backgroundColor: colors.bg,
      paddingBottom: 2
    },
    stopHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between'
    },
    stopTitleBlock: {
      flex: 1,
      minWidth: 0
    },
    stopCode: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '900'
    },
    stopName: {
      color: colors.tx,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 2
    },
    stopRoad: {
      color: colors.tx2,
      fontSize: 13,
      marginTop: 2
    },
    refreshButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    refreshButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    updatedText: {
      color: colors.tx2,
      fontSize: 12,
      marginBottom: 8,
      marginTop: 8
    },
    arrivalRow: {
      alignItems: 'center',
      borderTopColor: colors.ui,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12
    },
    serviceBadge: {
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      minHeight: 56,
      justifyContent: 'center',
      width: 76
    },
    serviceNo: {
      fontSize: 18,
      fontWeight: '900'
    },
    operator: {
      fontSize: 10,
      fontWeight: '800',
      marginTop: 2
    },
    busTimes: {
      flex: 1,
      minWidth: 0
    },
    busTimesContent: {
      gap: 8,
      paddingRight: 8
    },
    busTimePill: {
      alignItems: 'center',
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 56,
      justifyContent: 'center',
      paddingBottom: 16,
      paddingHorizontal: 8,
      paddingTop: 6,
      width: 76
    },
    busMinutes: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center'
    },
    busPillFooter: {
      alignItems: 'center',
      bottom: 6,
      flexDirection: 'row',
      gap: 4,
      left: 8,
      position: 'absolute',
      right: 6
    },
    crowdDensityPill: {
      borderRadius: 8,
      flex: 1,
      height: 7
    },
    crowdDensityPillWithWheelchair: {
      marginRight: 1
    },
    wheelchairIconWrap: {
      alignItems: 'center',
      height: 15,
      justifyContent: 'center',
      width: 15
    },
    emptyPanel: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-start',
      padding: 20,
      paddingTop: 16
    },
    emptyTitle: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 6
    },
    emptyText: {
      color: colors.tx2,
      fontSize: 13,
      textAlign: 'center'
    },
    settingsPage: {
      backgroundColor: colors.bg,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 100
    },
    settingsPageHeader: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 16
    },
    settingsPageTitle: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900'
    },
    headerSpacer: {
      width: 58
    },
    settingsPageContent: {
      padding: 20,
      paddingBottom: 40
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderRadius: 8,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    closeButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    fieldLabel: {
      color: colors.tx,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 8
    },
    modalText: {
      color: colors.tx2,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12
    },
    keyInput: {
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      fontSize: 15,
      height: 48,
      paddingHorizontal: 12
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 8,
      height: 44,
      justifyContent: 'center',
      marginTop: 12
    },
    primaryButtonText: {
      color: colors.bg,
      fontWeight: '900'
    },
    secondaryWideButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center'
    },
    secondaryWideButtonText: {
      color: colors.tx,
      fontWeight: '900'
    },
    disabledButton: {
      opacity: 0.65
    },
    settingsDivider: {
      backgroundColor: colors.ui,
      height: 1,
      marginVertical: 18
    },
    segmented: {
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      overflow: 'hidden'
    },
    segmentButton: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 42
    },
    segmentButtonActive: {
      backgroundColor: colors.accent
    },
    segmentText: {
      color: colors.tx2,
      fontWeight: '800'
    },
    segmentTextActive: {
      color: colors.bg
    }
  });
}

export type AppStyles = ReturnType<typeof createStyles>;
