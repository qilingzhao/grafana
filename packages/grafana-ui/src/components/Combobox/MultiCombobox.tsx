import { cx } from '@emotion/css';
import { useCombobox, useMultipleSelection } from 'downshift';
import { useCallback, useMemo, useState } from 'react';

import { useStyles2 } from '../../themes';
import { Checkbox } from '../Forms/Checkbox';
import { Box } from '../Layout/Box/Box';
import { Portal } from '../Portal/Portal';
import { Text } from '../Text/Text';
import { Tooltip } from '../Tooltip';

import { ComboboxOption, ComboboxBaseProps, AutoSizeConditionals, itemToString } from './Combobox';
import { OptionListItem } from './OptionListItem';
import { ValuePill } from './ValuePill';
import { getMultiComboboxStyles } from './getMultiComboboxStyles';
import { useMeasureMulti } from './useMeasureMulti';

interface MultiComboboxBaseProps<T extends string | number> extends Omit<ComboboxBaseProps<T>, 'value' | 'onChange'> {
  value?: T[] | Array<ComboboxOption<T>>;
  onChange: (items?: T[]) => void;
}

export type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const { options, placeholder, onChange, value, width } = props;
  const isAsync = typeof options === 'function';

  const selectedItems = useMemo(() => {
    if (!value || isAsync) {
      //TODO handle async
      return [];
    }

    return getSelectedItemsFromValue<T>(value, options);
  }, [value, options, isAsync]);

  const [items, _baseSetItems] = useState(isAsync ? [] : options);
  const [isOpen, setIsOpen] = useState(false);

  const multiStyles = useStyles2(getMultiComboboxStyles, isOpen);

  const { measureRef, suffixMeasureRef, shownItems } = useMeasureMulti(selectedItems, width);

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const [inputValue, setInputValue] = useState('');

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } = useMultipleSelection({
    selectedItems, //initally selected items,
    onStateChange: ({ type, selectedItems: newSelectedItems }) => {
      switch (type) {
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
        case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
          if (newSelectedItems) {
            onChange(getComboboxOptionsValues(newSelectedItems));
          }
          break;

        default:
          break;
      }
    },
  });

  const {
    //getToggleButtonProps,
    //getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
  } = useCombobox({
    isOpen,
    items,
    itemToString,
    inputValue,
    selectedItem: null,
    stateReducer: (state, actionAndChanges) => {
      const { changes, type } = actionAndChanges;
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          return {
            ...changes,
            isOpen: true,
            defaultHighlightedIndex: 0,
          };
        default:
          return changes;
      }
    },

    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          if (newSelectedItem) {
            if (!isOptionSelected(newSelectedItem)) {
              onChange(getComboboxOptionsValues([...selectedItems, newSelectedItem]));
              break;
            }
            removeSelectedItem(newSelectedItem); // onChange is handled by multiselect here
          }
          break;
        case useCombobox.stateChangeTypes.InputBlur:
          setIsOpen(false);
          setInputValue('');
          break;
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(newInputValue ?? '');
          break;
        default:
          break;
      }
    },
  });

  const visibleItems = isOpen ? selectedItems : selectedItems.slice(0, shownItems);

  return (
    <div>
      <div
        style={{ width: width === 'auto' ? undefined : width }}
        className={multiStyles.wrapper}
        ref={measureRef}
        onClick={() => selectedItems.length > 0 && setIsOpen(!isOpen)}
      >
        <span className={multiStyles.pillWrapper}>
          {visibleItems.map((item, index) => (
            <ValuePill
              onRemove={() => {
                removeSelectedItem(item);
              }}
              key={`${item.value}${index}`}
              {...getSelectedItemProps({ selectedItem: item, index })}
            >
              {itemToString(item)}
            </ValuePill>
          ))}
          {selectedItems.length > shownItems && !isOpen && (
            <Box display="flex" direction="row" marginLeft={0.5} gap={1} ref={suffixMeasureRef}>
              {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
              <Text>...</Text>
              <Tooltip
                interactive
                content={
                  <>
                    {selectedItems.slice(shownItems).map((item) => (
                      <div key={item.value}>{itemToString(item)}</div>
                    ))}
                  </>
                }
              >
                <div className={multiStyles.restNumber}>{selectedItems.length - shownItems}</div>
              </Tooltip>
            </Box>
          )}
          <input
            className={cx(multiStyles.input, {
              [multiStyles.inputClosed]: !isOpen && selectedItems.length > 0,
            })}
            {...getInputProps(
              getDropdownProps({
                preventKeyAction: isOpen,
                placeholder: selectedItems.length > 0 ? undefined : placeholder,
                onFocus: () => setIsOpen(true),
              })
            )}
          />
        </span>
      </div>
      <div {...getMenuProps()}>
        <Portal>
          {isOpen && (
            <div>
              {items.map((item, index) => {
                const itemProps = getItemProps({ item, index });
                const isSelected = isOptionSelected(item);
                const id = 'multicombobox-option-' + item.value.toString();
                return (
                  <li
                    key={item.value}
                    {...itemProps}
                    style={highlightedIndex === index ? { backgroundColor: 'blue' } : {}}
                  >
                    {' '}
                    {/* Add styling with virtualization */}
                    <Checkbox key={id} value={isSelected} aria-labelledby={id} />
                    <OptionListItem option={item} id={id} />
                  </li>
                );
              })}
            </div>
          )}
        </Portal>
      </div>
    </div>
  );
};

function getSelectedItemsFromValue<T extends string | number>(
  value: T[] | Array<ComboboxOption<T>>,
  options: Array<ComboboxOption<T>>
) {
  if (!isComboboxOptions(value)) {
    const resultingItems: Array<ComboboxOption<T> | undefined> = [];

    for (const item of options) {
      for (const [index, val] of value.entries()) {
        if (val === item.value) {
          resultingItems[index] = item;
        }
      }
      if (resultingItems.length === value.length && !resultingItems.includes(undefined)) {
        // We found all items for the values
        break;
      }
    }

    // Handle values that are not in options
    for (const [index, val] of value.entries()) {
      if (resultingItems[index] === undefined) {
        resultingItems[index] = { value: val };
      }
    }
    return resultingItems.filter((item) => item !== undefined); // TODO: Not actually needed, but TS complains
  }

  return value;
}

function isComboboxOptions<T extends string | number>(
  value: T[] | Array<ComboboxOption<T>>
): value is Array<ComboboxOption<T>> {
  return typeof value[0] === 'object';
}

function getComboboxOptionsValues<T extends string | number>(optionArray: Array<ComboboxOption<T>>) {
  return optionArray.map((option) => option.value);
}
