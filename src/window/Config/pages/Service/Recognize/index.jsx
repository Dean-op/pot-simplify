import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Card, Spacer, Button, useDisclosure } from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { useToastStyle } from '../../../../../hooks';
import { useConfig, deleteKey } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';
import ConfirmationDialog from '../../../../../components/ConfirmationDialog';
import { useServiceSave } from '../../../../../hooks/useServiceSave';

export default function Recognize() {
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('system');
    // now it's service instance list
    const [recognizeServiceInstanceList, setRecognizeServiceInstanceList, getRecognizeServiceInstanceList] = useConfig(
        'recognize_service_list',
        ['system']
    );

    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, confirmDelete] = useServiceSave({
        onSave: async () => {
            const list = getRecognizeServiceInstanceList();
            if (list.includes(deleteTarget.key) && list.length === 1) throw new Error(t('config.service.least'));
            await setRecognizeServiceInstanceList(
                list.filter((key) => key !== deleteTarget.key),
                true
            );
            await deleteKey(deleteTarget.key);
        },
        onSuccess: () => setDeleteTarget(null),
        onError: (error) => toast.error(t('config.service.save_failed') + String(error), { style: toastStyle }),
    });

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(recognizeServiceInstanceList, result.source.index, result.destination.index);
        setRecognizeServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey, name) => {
        if (recognizeServiceInstanceList.length === 1) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return;
        }
        setDeleteTarget({ key: instanceKey, name });
    };
    const updateServiceInstanceList = async (instanceKey) => {
        const list = getRecognizeServiceInstanceList();
        const newList = list.includes(instanceKey) ? [...list] : [...list, instanceKey];
        await setRecognizeServiceInstanceList(newList, true);
    };

    return (
        <>
            <Toaster />
            <ConfirmationDialog
                isOpen={deleteTarget !== null}
                title={t('config.service.delete_title')}
                message={t('config.service.delete_description', { name: deleteTarget?.name })}
                confirmText={t('config.service.delete')}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isDeleting}
            />
            <Card className='h-[calc(100vh-120px)] overflow-y-auto p-5 flex justify-between'>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable
                        droppableId='droppable'
                        direction='vertical'
                    >
                        {(provided) => (
                            <div
                                className='overflow-y-auto h-full'
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {recognizeServiceInstanceList !== null &&
                                    recognizeServiceInstanceList.map((x, i) => {
                                        return (
                                            <Draggable
                                                key={x}
                                                draggableId={x}
                                                index={i}
                                            >
                                                {(provided) => {
                                                    return (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                        >
                                                            <ServiceItem
                                                                {...provided.dragHandleProps}
                                                                serviceInstanceKey={x}
                                                                key={x}
                                                                deleteServiceInstance={deleteServiceInstance}
                                                                setCurrentConfigKey={setCurrentConfigKey}
                                                                onConfigOpen={onConfigOpen}
                                                            />
                                                            <Spacer y={2} />
                                                        </div>
                                                    );
                                                }}
                                            </Draggable>
                                        );
                                    })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                <Spacer y={2} />
                <Button
                    fullWidth
                    onPress={onSelectOpen}
                >
                    {t('config.service.add_builtin_service')}
                </Button>
            </Card>
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={onSelectOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                onOpenChange={onConfigOpenChange}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
