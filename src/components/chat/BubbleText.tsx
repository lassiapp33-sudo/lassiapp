import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

interface Props {
  text:   string;
  sender: 'me' | 'them';
  time:   string;
  read?:  boolean;  // accusé de lecture (me only)
}

const BUBBLE_RADIUS = 18;

export default function BubbleText({ text, sender, time, read }: Props) {
  const isMe = sender === 'me';

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        isMe ? styles.bubbleMe : styles.bubbleThem,
        // coin inférieur aplati côté émetteur (style iMessage)
        isMe
          ? { borderBottomRightRadius: 5 }
          : { borderBottomLeftRadius: 5 },
      ]}>
        <Text style={[styles.text, isMe ? styles.textMe : styles.textThem]}>
          {text}
        </Text>
      </View>
      <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem]}>
        {time}{isMe && read ? ' ✓✓' : isMe ? ' ✓' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    maxWidth: '80%',
  },
  rowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: BUBBLE_RADIUS,
  },
  bubbleMe: {
    backgroundColor: '#FDCF34',  // accent
  },
  bubbleThem: {
    backgroundColor: '#222447',
    borderWidth: 1,
    borderColor: colors.border,
  },

  text: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  textMe:   { color: colors.bg,    fontFamily: fonts.body },
  textThem: { color: colors.white },

  time: {
    color: '#5a5c80',
    fontFamily: fonts.body,
    fontSize: 9.5,
    marginTop: 4,
  },
  timeMe:   { marginRight: 3 },
  timeThem: { marginLeft: 3 },
});
