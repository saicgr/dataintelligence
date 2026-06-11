/* eslint-disable @typescript-eslint/no-require-imports -- RN bundles image assets via static require() */
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** The nerd-shark mascot's emotional states (one PNG each in assets/mascot). */
export type MascotMood =
  | 'reviewing'
  | 'thinking'
  | 'investigating'
  | 'idea'
  | 'coding'
  | 'confused'
  | 'warning'
  | 'wrong'
  | 'sad'
  | 'angry'
  | 'focused'
  | 'teaching'
  | 'celebrate'
  | 'smug'
  | 'reading';

const SOURCES: Record<MascotMood, number> = {
  reviewing: require('../../assets/mascot/reviewing.png'),
  thinking: require('../../assets/mascot/thinking.png'),
  investigating: require('../../assets/mascot/investigating.png'),
  idea: require('../../assets/mascot/idea_v4.png'),
  coding: require('../../assets/mascot/coding.png'),
  confused: require('../../assets/mascot/confused.png'),
  warning: require('../../assets/mascot/warning.png'),
  wrong: require('../../assets/mascot/wrong.png'),
  sad: require('../../assets/mascot/sad.png'),
  angry: require('../../assets/mascot/angry.png'),
  focused: require('../../assets/mascot/focused.png'),
  teaching: require('../../assets/mascot/teaching.png'),
  celebrate: require('../../assets/mascot/celebrate.png'),
  smug: require('../../assets/mascot/smug.png'),
  reading: require('../../assets/mascot/reading.png'),
};

/** Render a mascot state. `size` is the square box; the art keeps its aspect ratio (contain). */
export function Mascot({ mood, size = 96, style }: { mood: MascotMood; size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel={`mascot ${mood}`}
      source={SOURCES[mood]}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
