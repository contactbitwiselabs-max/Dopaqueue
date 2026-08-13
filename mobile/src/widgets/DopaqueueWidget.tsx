import React from 'react';
import { FlexWidget, TextWidget, ListWidget, IconWidget } from 'react-native-android-widget';

// This is the UI definition for the Android Home Screen Widget.
// Note: Native Android configuration (AndroidManifest.xml, WidgetProvider.java) 
// is required to fully deploy this to the home screen.

interface WidgetData {
  items: { id: string; title: string; urgency: string }[];
}

export function DopaqueueWidget({ items }: WidgetData) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'column',
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <TextWidget
          text="Dopaqueue"
          style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a' }}
        />
        <TextWidget
          text={`${items.length} Saves`}
          style={{ fontSize: 14, color: '#9CA3AF' }}
        />
      </FlexWidget>

      {items.length === 0 ? (
        <FlexWidget style={{ alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text="All caught up!" style={{ color: '#6B7280', fontSize: 14 }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1 }}>
          {items.slice(0, 5).map((item, index) => {
            const isHigh = item.urgency === 'High' || item.urgency === 'Tomorrow';
            return (
              <FlexWidget
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: index === Math.min(items.length, 5) - 1 ? 0 : 1,
                  borderColor: '#374151',
                }}
              >
                <FlexWidget
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isHigh ? '#EF4444' : '#3B82F6',
                    marginRight: 12,
                  }}
                />
                <TextWidget
                  text={item.title || 'Saved Link'}
                  style={{ color: '#F9FAFB', fontSize: 14 }}
                  maxLines={1}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
