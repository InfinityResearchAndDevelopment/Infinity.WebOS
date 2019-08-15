from threading import Lock
from flask import Flask, render_template, session, request, \
    copy_current_request_context, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, \
    close_room, rooms, disconnect
import random
import string
import os
import json
from datetime import datetime

# Set this variable to "threading", "eventlet" or "gevent" to test the
# different async modes, or leave it set to None for the application to choose
# the best option based on installed packages.
async_mode = None

Nodes={}
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode)
thread = None
thread_lock = Lock()
NodeMap={'Clients':{}}
# Get list of Nodes available.
def probeNodes():
    for f in [f.name for f in os.scandir('./Nodes') if os.path.isfile(f)]:
        file=open('./Nodes/'+f)
        data=file.read()
        data=json.loads(data)
        file.close()
        if data['Magic'] is None or data['Build'] is None:
            if data['Magic'] is None:
                data['Magic']=''.join(random.choices(string.ascii_letters + string.digits, k=32))
            if data['Build'] is None:
                data['Build']=datetime.now().strftime("%Y%m%d%H%M%S")
            file=open('./Nodes/'+f,'w+')
            file.write(json.dumps(data,indent=4))
            file.close()
        if not data['Magic'] in Nodes:
            Nodes[data['Magic']]={
                "File": f,
                "Alias": None,
                "Build": None,
                "Description": None,
                "Depends": None,
                "Assets": []
            }
            if data['Alias']:
                Nodes[data['Magic']]['Alias']=data['Alias']
            if data['Build']:
                Nodes[data['Magic']]['Build']=data['Build']
            if data['Description']:
                Nodes[data['Magic']]['Description']=data['Description']
            if data['Depends']:
                Nodes[data['Magic']]['Depends']=data['Depends']
            if data['Assets']:
                for o in data['Assets']:
                    if not o['Path'] in Nodes[data['Magic']]['Assets']:
                        Nodes[data['Magic']]['Assets']=o['Path']
                    Nodes[data['Magic']]['Assets'][o['Path']]={'File':o['File'],'Size':o['Size'],'Hash':o['Hash']}

def background_thread():
    """Example of how to send server generated events to clients."""
    # count = 0
    while True:
        socketio.sleep(60)
        probeNodes()

@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

@app.route('/Assets/<path:path>')
def send_asset(path):
    return send_from_directory('Assets', path)

@socketio.on('getNodes', namespace='/basic')
def getNodes():
    # probeNodes()
    emit('msgRecv',{'Result': "Success", 'data': Nodes})

@socketio.on('msgSend', namespace='/basic')
def test_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('msgRecv',
         {'data': message['data'], 'count': session['receive_count']})

@socketio.on('msgSendAll', namespace='/basic')
def test_broadcast_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('msgRecv',
         {'data': message['data'], 'count': session['receive_count']},
         broadcast=True)

@socketio.on('bootstrap', namespace='/basic')
def bootstrap(message):
    type=message['Type']
    if type=="Client":
        if 'Magic' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'Magic not specified'})
        elif 'Build' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'Build not specified'})
        else:
            if message['Magic'] not in NodeMap['Clients']:
                NodeMap['Clients'][message['Magic']]={
                    'Magic':message['Magic'],
                    'Build':message['Build'],
                    'Times':{
                        'Connected':datetime.now().strftime("%Y%m%d%H%M%S"),
                        'LastActive':datetime.now().strftime("%Y%m%d%H%M%S")
                    },
                    'Apps':{},
                    'TaskQueue':{},
                    'Events':{}
                    }
                join_room(message['Magic'])
                emit('msgRecv',{'Result': 'Success','Magic': message['Magic']})
            else:
                emit('msgRecv',{'Result': 'Fail','Reason':'Client already Initialized.'})
    elif type=="App":
        if 'Magic' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'Magic not specified'})
        elif 'AppMagic' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'AppMagic not specified'})
        elif 'Alias' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'Alias not specified'})
        elif 'Build' not in message:
            emit('msgRecv',{'Result': 'Fail','Reason':'Build not specified'})
        else:
            if message['AppMagic'] not in NodeMap['Clients'][message['Magic']]['Apps']:
                NodeMap['Clients'][message['Magic']]['Apps'][message['AppMagic']]={
                    'Magic':message['AppMagic'],
                    'Alias':message['Alias'],
                    'Build':message['Build'],
                    'TaskQueue':{},
                    'Events':{}
                    }
                emit('msgRecv',{'Result': 'Success','Magic': message['AppMagic']})
            else:
                emit('msgRecv',{'Result': 'Fail','Reason':'App already Initialized.'})
    session['receive_count'] = session.get('receive_count', 0) + 1

@socketio.on('leave', namespace='/basic')
def leave(message):
    leave_room(message['room'])
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('msgRecv',
         {'data': 'In rooms: ' + ', '.join(rooms()),
          'count': session['receive_count']})

@socketio.on('unregisterClient', namespace='/basic')
def close(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('msgRecv', {'data': 'Room ' + message['room'] + ' is closing.',
                     'count': session['receive_count']},
         room=message['room'])
    close_room(message['room'])

@socketio.on('my_room_event', namespace='/basic')
def send_room_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('msgRecv',
         {'data': message['data'], 'count': session['receive_count']},
         room=message['room'])

@socketio.on('disconnect_request', namespace='/basic')
def disconnect_request():
    @copy_current_request_context
    def can_disconnect():
        disconnect()

    session['receive_count'] = session.get('receive_count', 0) + 1
    # for this emit we use a callback function
    # when the callback function is invoked we know that the message has been
    # received and it is safe to disconnect
    emit('msgRecv',
         {'data': 'Disconnected!', 'count': session['receive_count']},
         callback=can_disconnect)

@socketio.on('ping_send', namespace='/basic')
def ping_pong():
    emit('ping_reply')

@socketio.on('connect', namespace='/basic')
def test_connect():
    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(background_thread)  # Here we start our event listener
    print('Client Connected', request.sid)
    emit('msgRecv', {'data': 'Connected', 'count': 0})

@socketio.on('disconnect', namespace='/basic')
def test_disconnect():
    print('Client disconnected', request.sid)

if __name__ == '__main__':
    probeNodes()
    socketio.run(app, debug=True)
