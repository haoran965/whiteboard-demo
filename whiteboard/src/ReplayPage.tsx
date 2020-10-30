import * as React from "react";
import {RouteComponentProps} from "react-router";
import {CursorTool} from "@netless/cursor-tool";
import polly from "polly-js";
import {message} from "antd";
import {WhiteWebSdk, PlayerPhase, Player, createPlugins} from "white-web-sdk";
import video_play from "./assets/image/video-play.svg";
import "video.js/dist/video-js.css";
import "./ReplayPage.less";
import PageError from "./PageError";
import PlayerController from "@netless/player-controller";
import {netlessWhiteboardApi} from "./apiMiddleware";
import {netlessToken} from "./appToken";
import LoadingPage from "./LoadingPage";
import logo from "./assets/image/logo.svg";
import ExitButtonPlayer from "./components/ExitButtonPlayer";
import { Identity } from "./IndexPage";
import {videoPlugin} from "@netless/white-video-plugin";
import {audioPlugin} from "@netless/white-audio-plugin";
export type PlayerPageProps = RouteComponentProps<{
    identity: Identity;
    uuid: string;
    userId: string;
}>;


export type PlayerPageStates = {
    player?: Player;
    phase: PlayerPhase;
    currentTime: number;
    isPlayerSeeking: boolean;
    isVisible: boolean;
    replayFail: boolean;
    replayState: boolean;
};

export default class NetlessPlayer extends React.Component<PlayerPageProps, PlayerPageStates> {
    public constructor(props: PlayerPageProps) {
        super(props);
        this.state = {
            currentTime: 0,
            phase: PlayerPhase.Pause,
            isPlayerSeeking: false,
            isVisible: false,
            replayFail: false,
            replayState: false,
        };
    }

    private getRoomToken = async (uuid: string): Promise<string | null> => {
        const roomToken = await netlessWhiteboardApi.room.joinRoomApi(uuid);

        return roomToken || null;
    };

    public async componentDidMount(): Promise<void> {
        window.addEventListener("keydown", this.handleSpaceKey);
        const {uuid, identity} = this.props.match.params;
        const plugins = createPlugins({"video": videoPlugin, "audio": audioPlugin});
        plugins.setPluginContext("video", {identity: identity === Identity.creator ? "host" : ""});
        plugins.setPluginContext("audio", {identity: identity === Identity.creator ? "host" : ""});
        const roomToken = await this.getRoomToken(uuid);
        if (uuid && roomToken) {
            const whiteWebSdk = new WhiteWebSdk({
                appIdentifier: netlessToken.appIdentifier,
                plugins,
            });
            await this.loadPlayer(whiteWebSdk, uuid, roomToken);
        }
    }

    private loadPlayer = async (whiteWebSdk: WhiteWebSdk, uuid: string, roomToken: string): Promise<void> => {
        const replayState = await polly().waitAndRetry(10).executeForPromise(async () => {
             return await whiteWebSdk.isPlayable({
                region: "cn-hz",
                room: uuid,
            });
        });

        if (replayState) {
            this.setState({replayState: true});
            await this.startPlayer(whiteWebSdk, uuid, roomToken);
        }
    }

    private startPlayer = async (whiteWebSdk: WhiteWebSdk, uuid: string, roomToken: string): Promise<void> => {
        const cursorAdapter = new CursorTool();
        const player = await whiteWebSdk.replayRoom(
            {
                room: uuid,
                roomToken: roomToken,
                cursorAdapter: cursorAdapter,
            }, {
                onPhaseChanged: phase => {
                    this.setState({phase: phase});
                },
                onStoppedWithError: (error: Error) => {
                    message.error(`Playback error: ${error}`);
                    this.setState({replayFail: true});
                },
                onProgressTimeChanged: (scheduleTime: number) => {
                    this.setState({currentTime: scheduleTime});
                },
            });
        (window as any).player = player;
        cursorAdapter.setPlayer(player);
        this.setState({
            player: player,
        });
    }

    private handleBindRoom = (ref: HTMLDivElement): void => {
        const {player} = this.state;
        if (player) {
            player.bindHtmlElement(ref);
        }
    }

    private handleSpaceKey = (evt: any): void => {
        if (evt.code === "Space") {
            if (this.state.player) {
                this.onClickOperationButton(this.state.player);
            }
        }
    }

    private onClickOperationButton = (player: Player): void => {
        switch (player.phase) {
            case PlayerPhase.WaitingFirstFrame:
            case PlayerPhase.Pause: {
                player.play();
                break;
            }
            case PlayerPhase.Playing: {
                player.pause();
                break;
            }
            case PlayerPhase.Ended: {
                player.seekToScheduleTime(0);
                break;
            }
        }
    }
    private renderScheduleView(): React.ReactNode {
        const {player, isVisible} = this.state;
        if (player && isVisible) {
            return (
                <div onMouseEnter={() => this.setState({isVisible: true})}>
                    <PlayerController player={player}/>
                </div>
            );
        } else {
            return null;
        }
    }


    public render(): React.ReactNode {
        const {player, phase, replayState} = this.state;
        const { identity, uuid, userId } = this.props.match.params;
        if (this.state.replayFail) {
            return <PageError/>;
        }
        if (!replayState) {
            return <LoadingPage text={"正在生成回放请耐心等待"}/>;
        }
        if (player === undefined) {
            return <LoadingPage/>;
        }
        switch (phase) {
            case (PlayerPhase.WaitingFirstFrame): {
                return <LoadingPage/>;
            }
            default: {
                return (
                    <div className="player-out-box">
                        <div className="logo-box">
                            <img src={logo} alt={"logo"}/>
                        </div>
                        <div className="room-controller-box">
                            <div className="page-controller-mid-box">
                                <ExitButtonPlayer
                                    identity={identity}
                                    uuid={uuid}
                                    userId={userId}
                                    player={player}
                                />

                            </div>
                        </div>
                        <div className="player-board">
                            {this.renderScheduleView()}
                            <div
                                className="player-board-inner"
                                onMouseOver={() => this.setState({isVisible: true})}
                                onMouseLeave={() => this.setState({isVisible: false})}
                            >
                                <div
                                    onClick={() => this.onClickOperationButton(player)}
                                    className="player-mask">
                                    {phase === PlayerPhase.Pause &&
                                    <div className="player-big-icon">
                                        <img
                                            style={{width: 50, marginLeft: 6}}
                                            src={video_play}
                                            alt={"video_play"}/>
                                    </div>}
                                </div>
                                <div style={{backgroundColor: "#F2F2F2"}}
                                     className="player-box"
                                     ref={this.handleBindRoom}/>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    }
}
