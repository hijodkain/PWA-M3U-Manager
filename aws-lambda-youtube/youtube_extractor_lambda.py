import json
import os
import boto3
from decimal import Decimal
import requests
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('YOUTUBE_CHANNELS_TABLE', 'YouTubeChannelsLive')
table = dynamodb.Table(table_name)

def extract_m3u8_url(youtube_url):
    try:
        response = requests.get(youtube_url, timeout=15)
        html = response.text
        
        if '.m3u8' not in html:
            print(f"No .m3u8 found in {youtube_url}")
            return None
        
        end = html.find('.m3u8') + 5
        tuner = 100
        while tuner < 1000:
            segment = html[end-tuner:end]
            if 'https://' in segment:
                start = segment.find('https://')
                m3u8_url = segment[start:]
                print(f"M3U8 extracted: {m3u8_url[:80]}")
                return m3u8_url
            tuner += 5
        
        print("Could not find M3U8 URL start")
        return None
    except Exception as e:
        print(f"Error extracting M3U8: {e}")
        return None

def lambda_handler(event, context):
    if 'source' in event and event['source'] == 'aws.events':
        return update_all_channels()
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', 'extract')
    
    try:
        if action == 'extract':
            return extract_action(params)
        elif action == 'add':
            return add_channel(params)
        elif action == 'list':
            return list_channels()
        elif action == 'remove':
            return remove_channel(params)
        elif action == 'get_m3u8':
            return get_channel_m3u8(params)
        else:
            return error_response(400, f'Invalid action: {action}')
    except Exception as e:
        print(f"Error: {e}")
        return error_response(500, str(e))

def error_response(code, message):
    return {
        'statusCode': code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': message})
    }

def success_response(data):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(data)
    }

def extract_action(params):
    youtube_url = params.get('url')
    if not youtube_url:
        return error_response(400, 'Missing url parameter')
    
    m3u8_url = extract_m3u8_url(youtube_url)
    if m3u8_url:
        return success_response({
            'm3u8_url': m3u8_url,
            'youtube_url': youtube_url,
            'extracted_at': datetime.utcnow().isoformat()
        })
    else:
        return error_response(404, 'Could not extract M3U8 URL')

def add_channel(params):
    channel_id = params.get('channel_id')
    youtube_url = params.get('url')
    name = params.get('name', '')
    
    if not channel_id or not youtube_url:
        return error_response(400, 'Missing channel_id or url parameter')
    
    m3u8_url = extract_m3u8_url(youtube_url)
    item = {
        'channel_id': channel_id,
        'name': name,
        'youtube_url': youtube_url,
        'm3u8_url': m3u8_url or '',
        'last_updated': datetime.utcnow().isoformat(),
        'created_at': datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    return success_response({'message': 'Channel added', 'channel': item})

def list_channels():
    response = table.scan()
    items = response.get('Items', [])
    items = decimal_to_float(items)
    return success_response({'channels': items, 'count': len(items)})

def remove_channel(params):
    channel_id = params.get('channel_id')
    if not channel_id:
        return error_response(400, 'Missing channel_id parameter')
    
    table.delete_item(Key={'channel_id': channel_id})
    return success_response({'message': 'Channel removed', 'channel_id': channel_id})

def get_channel_m3u8(params):
    channel_id = params.get('channel_id')
    if not channel_id:
        return error_response(400, 'Missing channel_id parameter')
    
    response = table.get_item(Key={'channel_id': channel_id})
    item = response.get('Item')
    if not item:
        return error_response(404, 'Channel not found')
    
    item = decimal_to_float(item)
    return success_response({'channel': item})

def update_all_channels():
    print("Updating all channels...")
    response = table.scan()
    items = response.get('Items', [])
    
    updated_count = 0
    failed_count = 0
    
    for item in items:
        channel_id = item['channel_id']
        youtube_url = item['youtube_url']
        print(f"Updating {channel_id}")
        
        try:
            m3u8_url = extract_m3u8_url(youtube_url)
            if m3u8_url:
                table.update_item(
                    Key={'channel_id': channel_id},
                    UpdateExpression='SET m3u8_url = :m3u8, last_updated = :updated',
                    ExpressionAttributeValues={
                        ':m3u8': m3u8_url,
                        ':updated': datetime.utcnow().isoformat()
                    }
                )
                updated_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"Error updating {channel_id}: {e}")
            failed_count += 1
    
    result = {
        'message': 'Update completed',
        'updated': updated_count,
        'failed': failed_count,
        'total': len(items),
        'timestamp': datetime.utcnow().isoformat()
    }
    print(f"Summary: {result}")
    return success_response(result)

def decimal_to_float(obj):
    if isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj
