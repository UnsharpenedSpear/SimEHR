import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import {
  ORDER_PRIORITIES,
  DISPATCH_STATUSES,
  PROCEDURE_STATUSES,
  CLINICAL_NOTE_STATUSES,
  LAB_RESULT_FLAGS,
} from '@ehr/shared';

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: string;
  category?: 'priority' | 'dispatch' | 'procedure' | 'note' | 'lab' | 'default';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, category = 'default', sx, ...props }) => {
  let bgcolor = 'grey.200';
  let color = 'grey.900';
  let label = status;

  if (category === 'priority' || status in ORDER_PRIORITIES) {
    if (status === ORDER_PRIORITIES.STAT) {
      bgcolor = '#f9dedc';
      color = '#b3261e';
    } else if (status === ORDER_PRIORITIES.URGENT) {
      bgcolor = '#ffe0b2';
      color = '#e65100';
    } else {
      bgcolor = '#e8f5e9';
      color = '#2e7d32';
    }
  } else if (category === 'dispatch' || status in DISPATCH_STATUSES) {
    switch (status) {
      case DISPATCH_STATUSES.CREATED:
      case DISPATCH_STATUSES.DISPATCHED:
        bgcolor = '#e1f5fe';
        color = '#0277bd';
        break;
      case DISPATCH_STATUSES.ACKNOWLEDGED:
      case DISPATCH_STATUSES.IN_PROGRESS:
        bgcolor = '#fff9c4';
        color = '#f57f17';
        break;
      case DISPATCH_STATUSES.COMPLETED:
        bgcolor = '#e8f5e9';
        color = '#2e7d32';
        break;
      case DISPATCH_STATUSES.REJECTED:
      case DISPATCH_STATUSES.CANCELLED:
        bgcolor = '#ffebee';
        color = '#c62828';
        break;
      case DISPATCH_STATUSES.ON_HOLD:
        bgcolor = '#ede7f6';
        color = '#512da8';
        break;
    }
  } else if (category === 'note' || status in CLINICAL_NOTE_STATUSES) {
    if (status === CLINICAL_NOTE_STATUSES.SIGNED) {
      bgcolor = '#e8f5e9';
      color = '#2e7d32';
      label = 'Signed (Immutable)';
    } else if (status === CLINICAL_NOTE_STATUSES.AMENDED) {
      bgcolor = '#ede7f6';
      color = '#512da8';
      label = 'Amended';
    } else {
      bgcolor = '#fff3e0';
      color = '#ef6c00';
      label = 'Draft';
    }
  } else if (category === 'lab' || status in LAB_RESULT_FLAGS) {
    if (status === LAB_RESULT_FLAGS.CRITICAL) {
      bgcolor = '#b3261e';
      color = '#ffffff';
      label = 'CRITICAL';
    } else if (status === LAB_RESULT_FLAGS.HIGH) {
      bgcolor = '#ffebee';
      color = '#c62828';
      label = 'HIGH';
    } else if (status === LAB_RESULT_FLAGS.LOW) {
      bgcolor = '#e3f2fd';
      color = '#1565c0';
      label = 'LOW';
    } else {
      bgcolor = '#e8f5e9';
      color = '#2e7d32';
      label = 'NORMAL';
    }
  }

  return (
    <Chip
      size="small"
      label={label}
      sx={{
        bgcolor,
        color,
        fontWeight: 600,
        fontSize: '0.75rem',
        borderRadius: 1.5,
        ...sx,
      }}
      {...props}
    />
  );
};
