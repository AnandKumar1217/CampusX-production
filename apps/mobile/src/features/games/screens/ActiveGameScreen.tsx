import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { TicTacToeScreen } from "../games/ticTacToe/TicTacToeScreen";
import { ConnectFourScreen } from "../games/connectFour/ConnectFourScreen";
import { PongScreen } from "../games/pong/PongScreen";
import { AirHockeyScreen } from "../games/airHockey/AirHockeyScreen";
import { CheckersScreen } from "../games/checkers/CheckersScreen";
import { ChessScreen } from "../games/chess/ChessScreen";
import { ReversiScreen } from "../games/reversi/ReversiScreen";
import { DotsAndBoxesScreen } from "../games/dotsAndBoxes/DotsAndBoxesScreen";
import { MancalaScreen } from "../games/mancala/MancalaScreen";
import { SnakeScreen } from "../games/snake/SnakeScreen";
import { FootballScreen } from "../games/football/FootballScreen";


import { ReactionScreen } from "../games/reaction/ReactionScreen";
import { QuizScreen } from "../games/quiz/QuizScreen";
import { MazeScreen } from "../games/maze/MazeScreen";
import { View, Text } from "react-native";

type Props = NativeStackScreenProps<any, any>;

export function ActiveGameScreen(props: Props) {
  const { gameId } = props.route.params as any;

  switch (gameId) {
    case "tictactoe": return <TicTacToeScreen {...props} />;
    case "connectfour": return <ConnectFourScreen {...props} />;
    case "pong": return <PongScreen {...props} />;
    case "airhockey": return <AirHockeyScreen {...props} />;
    case "checkers": return <CheckersScreen {...props} />;
    case "chess": return <ChessScreen {...props} />;
    case "reversi": return <ReversiScreen {...props} />;
    case "mancala": return <MancalaScreen {...props} />;
    case "dotsandboxes": return <DotsAndBoxesScreen {...props} />;
    case "snake": return <SnakeScreen {...props} />;
    case "football": return <FootballScreen {...props} />;


    case "reaction": return <ReactionScreen {...props} />;
    case "quiz": return <QuizScreen {...props} />;
    case "maze": return <MazeScreen {...props} />;
    default:
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>Game {gameId} not found.</Text>
        </View>
      );
  }
}
