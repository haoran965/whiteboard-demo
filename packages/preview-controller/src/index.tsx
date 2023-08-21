import * as React from "react";
import {Room, WhiteScene, RoomState} from "white-web-sdk";
import MenuBox from "@netless/menu-box";
import close from "./image/close.svg";
import addPage from "./image/add-page.svg";
import "./index.less";
import deleteIcon from "./image/delete.svg";
import { ProjectorPlugin } from "@netless/projector-plugin"

export type PreviewControllerState = {
    isFocus: boolean;
    hoverCellIndex: number | null;
    scenesCount: number;
    slidePreviewUrl: string[];
};

export type PreviewControllerProps = {
    room: Room;
    handlePreviewState: (state: boolean) => void;
    isVisible: boolean;
    projectorPlugin?: ProjectorPlugin;
};

class PreviewController extends React.Component<PreviewControllerProps, PreviewControllerState> {

    public constructor(props: PreviewControllerProps) {
        super(props);
        this.state = {
            isFocus: false,
            hoverCellIndex: null,
            scenesCount: 0,
            slidePreviewUrl: [],
        };
    }

    private setScenePath = (newActiveIndex: number) => {
        if (this.props.projectorPlugin) {
            this.props.projectorPlugin.renderSlidePage(newActiveIndex + 1);
        } else {
            const {room} = this.props;
            room.setSceneIndex(newActiveIndex);
        }
    }
    private pathName = (path: string): string => {
        const cells = path.split("/");
        const popCell = cells.pop();
        if (popCell === "") {
            cells.pop();
        }
        return cells.join("/");
    }

    public componentDidUpdate(prevProps: Readonly<PreviewControllerProps>) {
        if (prevProps.projectorPlugin === this.props.projectorPlugin) {
            return;
        }
        if (!this.props.projectorPlugin) {
            return;
        }
        const sceneDir = this.props.room.state.sceneState.scenePath.split("/");
        this.props.projectorPlugin.listSlidePreviews(sceneDir[2]).then(slide => {
            this.setState({ slidePreviewUrl: slide })
        })
    }

    public componentDidMount(): void {
        const { room } = this.props;
        this.setState({ scenesCount: room.state.sceneState.scenes.length });
        room.callbacks.on("onRoomStateChanged", this.onRoomStateChanged);
    }

    private onRoomStateChanged = (): void => {
        const { room } = this.props;
        this.setState({ scenesCount: room.state.sceneState.scenes.length });
    }

    public componentWillUnmount(): void {
        const { room } = this.props;
        room.callbacks.off("onRoomStateChanged", this.onRoomStateChanged);
    }

    private renderPreviewCells = (scenes: ReadonlyArray<WhiteScene>, activeIndex: number, sceneDir: any): React.ReactNode => {
        const {isVisible} = this.props;
        const { slidePreviewUrl } = this.state;
        const nodes: React.ReactNode = scenes.map((scene, index) => {
            const isActive = index === activeIndex;
            const scenePath = sceneDir.concat(scene.name).join("/");
            const slidePreview = slidePreviewUrl[index];
            return (
                <div key={`key-${scenePath}`} className="page-out-box">
                    <div
                        onClick={() => {
                            this.setScenePath(index);
                        }}
                        className="page-box" style={{borderColor: isActive ? "#71C3FC" : "#F4F4F4"}}>
                        <PageImage
                            room={this.props.room}
                            path={scenePath}
                            imageUrl={slidePreview}
                        />
                    </div>
                    <div className="page-box-under">
                        <div className="page-box-under-left">
                            {index + 1}
                        </div>
                        <div onClick={() => this.props.room.removeScenes(`${scenePath}`)} className="page-box-under-right">
                            <img src={deleteIcon} alt={"deleteIcon"}/>
                        </div>
                    </div>
                </div>
            );
        });
        if (!isVisible) {
            return null;
        }

        return (
            <div className="preview-cells-box">
                {nodes}
            </div>
        );
    }

    private addPage = (): void => {
        const {room} = this.props;
        const activeIndex = room.state.sceneState.index;
        const newSceneIndex = activeIndex + 1;
        const scenePath = room.state.sceneState.scenePath;
        const pathName = this.pathName(scenePath);
        room.putScenes(pathName, [{}], newSceneIndex);
        room.setSceneIndex(newSceneIndex);
    }

    private onMenuState = (isOpen: boolean): void => {
        const {handlePreviewState} = this.props;
        if (isOpen) {
            handlePreviewState(true);
        } else {
            handlePreviewState(false);
        }
    }

    public render(): React.ReactNode {
        const {isVisible, handlePreviewState, room} = this.props;
        const scenes = room.state.sceneState.scenes;
        const sceneDir = room.state.sceneState.scenePath.split("/");
        sceneDir.pop();
        const activeIndex = room.state.sceneState.index;
        return (
            <MenuBox onMenuState={this.onMenuState} width={240} isVisible={isVisible}>
                <div className="menu-annex-box" style={{ outline: 0 }}>
                    <div className="menu-title-line-box">
                        <div className="menu-title-line">
                            <div className="menu-title-text-box">
                                Preview
                            </div>
                            <div className="menu-title-left">
                                <div onClick={this.addPage} className="menu-head-btn">
                                    <img src={addPage} alt={"addPage"}/>
                                </div>
                                <div className="menu-head-btn" style={{marginLeft: 8}}
                                     onClick={() => handlePreviewState(false)}>
                                    <img src={close} alt={"close"}/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{height: 64}}/>
                    <div className="menu-annex-body">
                        {this.renderPreviewCells(scenes, activeIndex, sceneDir)}
                    </div>
                </div>
            </MenuBox>
        );
    }
}

export type PageImageProps = { path: string, room: Room, imageUrl?: string };

class PageImage extends React.Component<PageImageProps, {}> {

    private ref = React.createRef<HTMLDivElement>()

    public componentDidMount(): void {
        const { room } = this.props;
        if (this.props.imageUrl) {
            return;
        }
        window.setTimeout(this.syncPreview.bind(this));
        room.callbacks.on("onRoomStateChanged", this.syncPreviewIfNeeded);
    }

    private syncPreviewIfNeeded = (): void => {
        const { room } = this.props;
        if (room.state.sceneState.scenePath === this.props.path && this.ref.current) {
            this.syncPreview();
        }
    }

    public componentDidUpdate(prevProps: PageImageProps): void {
        if (prevProps.path !== this.props.path && !this.props.imageUrl) {
            this.syncPreview();
        }
        if (prevProps.imageUrl !== this.props.imageUrl) {
            this.render();
        }
    }

    public componentWillUnmount(): void {
        const { room } = this.props;
        room.callbacks.off("onRoomStateChanged", this.syncPreviewIfNeeded);
    }

    public renderWhiteboard() {
        return <div className="ppt-image" ref={this.ref}/>;
    }

    public renderImage() {
        return <img className="ppt-image" src={this.props.imageUrl} style={{width: '208px', height:'156px' }}  alt="预览图"/>;
    }

    public render(): React.ReactNode {
        if (this.props.imageUrl) {
            return this.renderImage();
        }
        return this.renderWhiteboard();
    }

    private syncPreview(): void {
        if (this.ref.current) {
            this.props.room.scenePreview(this.props.path, this.ref.current, 208, 156);
            this.ref.current.dataset.path = this.props.path;
        }
    }
}

export default PreviewController;
