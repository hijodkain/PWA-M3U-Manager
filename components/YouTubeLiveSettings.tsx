import React, { useState } from 'react';
import { Button, Form, Input, InputNumber, Space, Switch, Table } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { YouTubeChannel, YouTubeChannelStatus } from '../hooks/useYouTubeLiveMonitor';
import { AntIcon } from './AntIcon';

interface YouTubeLiveSettingsProps {
    channels: YouTubeChannel[];
    channelsStatus: Record<string, YouTubeChannelStatus>;
    settings: {
        enabled: boolean;
        globalInterval: number;
    };
    onAddChannel: (channel: Omit<YouTubeChannel, 'id' | 'addedDate'>) => void;
    onRemoveChannel: (id: string) => void;
    onUpdateSettings: (settings: { enabled: boolean; globalInterval: number }) => void;
    onCheckChannel: (id: string) => Promise<void>;
}

const YouTubeLiveSettings: React.FC<YouTubeLiveSettingsProps> = ({
    channels,
    channelsStatus,
    settings,
    onAddChannel,
    onRemoveChannel,
    onUpdateSettings,
    onCheckChannel,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleAddChannel = async (values: any) => {
        onAddChannel({
            channelUrl: values.channelUrl,
            name: values.name,
            group: values.group,
            intervalMinutes: values.intervalMinutes || settings.globalInterval,
        });
        form.resetFields();
    };

    const columns = [
        {
            title: 'Nombre',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'URL del Canal',
            dataIndex: 'channelUrl',
            key: 'channelUrl',
            width: 250,
        },
        {
            title: 'Grupo',
            dataIndex: 'group',
            key: 'group',
            width: 150,
        },
        {
            title: 'Estado',
            key: 'status',
            width: 150,
            render: (_: any, record: YouTubeChannel) => {
                const status = channelsStatus[record.id];
                return status?.verification.status || 'Sin verificar';
            },
        },
        {
            title: 'Título actual',
            key: 'currentTitle',
            width: 250,
            render: (_: any, record: YouTubeChannel) => {
                const status = channelsStatus[record.id];
                return status?.currentTitle || '-';
            },
        },
        {
            title: 'Última verificación',
            key: 'lastCheck',
            width: 200,
            render: (_: any, record: YouTubeChannel) => {
                const status = channelsStatus[record.id];
                return status?.lastCheck 
                    ? new Date(status.lastCheck).toLocaleString()
                    : '-';
            },
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 150,
            render: (_: any, record: YouTubeChannel) => (
                <Space>
                    <Button
                        icon={<AntIcon icon={ReloadOutlined} />}
                        onClick={() => onCheckChannel(record.id)}
                        loading={channelsStatus[record.id]?.verification.status === 'verifying'}
                    />
                    <Button
                        icon={<AntIcon icon={DeleteOutlined} />}
                        danger
                        onClick={() => onRemoveChannel(record.id)}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <span>Monitoreo automático:</span>
                <Switch
                    checked={settings.enabled}
                    onChange={(checked) =>
                        onUpdateSettings({ ...settings, enabled: checked })
                    }
                />
                <span>Intervalo global (minutos):</span>
                <InputNumber
                    min={1}
                    max={60}
                    value={settings.globalInterval}
                    onChange={(value) =>
                        onUpdateSettings({ ...settings, globalInterval: value || 5 })
                    }
                />
            </div>

            <Form
                form={form}
                layout="inline"
                onFinish={handleAddChannel}
                className="space-y-4"
            >
                <Form.Item
                    name="name"
                    rules={[{ required: true, message: 'Nombre requerido' }]}
                >
                    <Input placeholder="Nombre del canal" style={{ width: 200 }} />
                </Form.Item>

                <Form.Item
                    name="channelUrl"
                    rules={[
                        { required: true, message: 'URL requerida' },
                        {
                            pattern: /^https?:\/\/(www\.)?youtube\.com\/.+/,
                            message: 'URL de YouTube inválida',
                        },
                    ]}
                >
                    <Input placeholder="URL del canal de YouTube" style={{ width: 300 }} />
                </Form.Item>

                <Form.Item name="group">
                    <Input placeholder="Grupo (opcional)" style={{ width: 150 }} />
                </Form.Item>

                <Form.Item name="intervalMinutes">
                    <InputNumber
                        placeholder="Intervalo (min)"
                        min={1}
                        max={60}
                        style={{ width: 120 }}
                    />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>
                        Agregar canal
                    </Button>
                </Form.Item>
            </Form>

            <Table
                dataSource={channels}
                columns={columns}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={false}
            />
        </div>
    );
};

export default YouTubeLiveSettings;